using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Text.Json;
using System.Text;
using System.Collections.Concurrent;

namespace Lotka.Controllers;

[ApiController]
[Route("api/lotka-platform")]
public sealed class LotkaPlatformController : ControllerBase
{
    private readonly IHttpClientFactory _clients;
    private readonly IConfiguration _config;
    public LotkaPlatformController(IHttpClientFactory clients, IConfiguration config)
    {
        _clients = clients;
        _config = config;
    }

    // Browser-facing RFQ gateway. Disabled until owner-approved CAPTCHA and
    // server-side token are configured. No client receives the upstream token.
    private static readonly ConcurrentDictionary<string, (int Count, DateTime Start)> Attempts = new();

    [HttpPost("rfq")]
    [RequestSizeLimit(32768)]
    public async Task<IActionResult> SubmitRfq(
        [FromBody] JsonElement request, CancellationToken cancellationToken)
    {
        if (_config["LOTKA_WEBSITE_RFQ_ENABLED"] != "ENABLED")
            return StatusCode(503, new { accepted = false, error = "RFQ intake not enabled" });
        var secret = _config["LOTKA_WEBSITE_TURNSTILE_SECRET"];
        var upstreamToken = _config["LOTKA1_SERVICE_TOKEN"];
        var expectedHost = _config["LOTKA_WEBSITE_PUBLIC_HOST"];
        var upstream = _config["LOTKA1_INTERNAL_URL"];
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(upstreamToken) ||
            string.IsNullOrWhiteSpace(expectedHost) || string.IsNullOrWhiteSpace(upstream) ||
            !Uri.TryCreate(upstream, UriKind.Absolute, out var upstreamUri))
            return StatusCode(503, new { accepted = false, error = "Gateway not configured" });
        if (request.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("privacy_consent", out var consent) ||
            consent.ValueKind != JsonValueKind.True ||
            !request.TryGetProperty("turnstile_token", out var captcha) ||
            captcha.ValueKind != JsonValueKind.String)
            return BadRequest(new { accepted = false, error = "Consent or verification missing" });
        var origin = Request.Headers["Origin"].ToString();
        if (origin != "https://" + expectedHost || Request.Host.Host != expectedHost)
            return StatusCode(403, new { accepted = false, error = "Origin rejected" });
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTime.UtcNow;
        var count = Attempts.AddOrUpdate(ip, (1, now), (_, old) =>
            (now - old.Start).TotalMinutes >= 1 ? (1, now) : (old.Count + 1, old.Start));
        if (count.Count > 5)
            return StatusCode(429, new { accepted = false, error = "Rate limit exceeded" });
        try
        {
            var client = _clients.CreateClient("lotka1");
            using var captchaRequest = new HttpRequestMessage(HttpMethod.Post,
                "https://challenges.cloudflare.com/turnstile/v0/siteverify");
            captchaRequest.Content = new FormUrlEncodedContent(new Dictionary<string,string> {
                ["secret"] = secret, ["response"] = captcha.GetString() ?? ""
            });
            using var captchaResponse = await client.SendAsync(captchaRequest, cancellationToken);
            if (!captchaResponse.IsSuccessStatusCode)
                return StatusCode(503, new { accepted = false, error = "Verification unavailable" });
            using var captchaJson = await JsonDocument.ParseAsync(
                await captchaResponse.Content.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            var verified = captchaJson.RootElement;
            if (!verified.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True ||
                !verified.TryGetProperty("hostname", out var hostname) || hostname.GetString() != expectedHost)
                return StatusCode(403, new { accepted = false, error = "Verification failed" });
            var payload = new Dictionary<string,JsonElement>();
            foreach (var property in request.EnumerateObject())
                if (property.Name is not ("turnstile_token" or "privacy_consent" or "website"))
                    payload[property.Name] = property.Value.Clone();
            if (request.TryGetProperty("website", out var honeypot) &&
                honeypot.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(honeypot.GetString()))
                return BadRequest(new { accepted = false, error = "Invalid request" });
            var idempotency = Request.Headers["X-Request-Key"].ToString();
            if (idempotency.Length < 12 || idempotency.Length > 100 ||
                !idempotency.All(c => c <= 127))
                return BadRequest(new { accepted = false, error = "Invalid request key" });
            using var forward = new HttpRequestMessage(HttpMethod.Post,
                new Uri(upstreamUri, "/api/get-quote/submit"));
            forward.Headers.TryAddWithoutValidation("X-Lotka-Token", upstreamToken);
            forward.Headers.TryAddWithoutValidation("X-Request-Key", idempotency);
            forward.Content = new StringContent(JsonSerializer.Serialize(payload),
                Encoding.UTF8, "application/json");
            using var reply = await client.SendAsync(forward, cancellationToken);
            var response = await reply.Content.ReadAsStringAsync(cancellationToken);
            return new ContentResult {
                StatusCode = (int)reply.StatusCode,
                ContentType = "application/json; charset=utf-8",
                Content = response.Length <= 8192 ? response : "{\"error\":\"Invalid upstream response\"}"
            };
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { accepted = false, error = "Platform unavailable" });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { accepted = false, error = "Gateway timeout" });
        }
    }

    // Read-only connectivity probe; does not disclose private service credentials.
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        var endpoint = _config["LOTKA1_INTERNAL_URL"];
        if (string.IsNullOrWhiteSpace(endpoint) ||
            !Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) ||
            !string.IsNullOrEmpty(uri.UserInfo))
            return StatusCode(503, new { connected = false, reason = "not_configured" });

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,
                new Uri(uri, "/api/health"));
            using var response = await _clients.CreateClient("lotka1")
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return StatusCode(502, new { connected = false, reason = "upstream_unhealthy" });
            using var json = await JsonDocument.ParseAsync(
                await response.Content.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            if (!json.RootElement.TryGetProperty("status", out var status) ||
                status.GetString() != "ok")
                return StatusCode(502, new { connected = false, reason = "invalid_upstream" });
            return Ok(new { connected = true, service = "LOTKA 1", environment = "staging" });
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(504, new { connected = false, reason = "timeout" });
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { connected = false, reason = "unreachable" });
        }
    }
}
