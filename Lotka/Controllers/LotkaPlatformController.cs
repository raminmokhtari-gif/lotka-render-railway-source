using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Text.Json;

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
