using Lotka.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace Lotka.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        private bool IsSpaRequest()
        {
            return Request.Headers["X-Spa-Request"] == "true" ||
                   Request.Headers["X-Requested-With"] == "XMLHttpRequest";
        }

        private IActionResult RenderSpaView(string viewName, object? model = null)
        {
            ViewData["ActivePage"] = viewName;
            if (IsSpaRequest())
            {
                return PartialView(viewName, model);
            }
            return View(viewName, model);
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Global Logistics | People + AI Moving Business Forward";
            return RenderSpaView("Index");
        }

        public IActionResult About()
        {
            ViewData["Title"] = "About Us | Human Expertise + Cognitive AI";
            return RenderSpaView("About");
        }

        public IActionResult Services()
        {
            ViewData["Title"] = "Logistics Services | Air, Ocean, Land & AI Routing";
            return RenderSpaView("Services");
        }

        public IActionResult WhyLotka()
        {
            ViewData["Title"] = "Why LOTKA | The Intelligent Logistics Edge";
            return RenderSpaView("WhyLotka");
        }

        public IActionResult Benefits()
        {
            ViewData["Title"] = "Benefits | Faster Quotes, Greater Transparency & Zero Errors";
            return RenderSpaView("Benefits");
        }

        public IActionResult Faq()
        {
            ViewData["Title"] = "FAQ | Questions on Freight, Tracking & AI Integration";
            return RenderSpaView("Faq");
        }

        public IActionResult Contact()
        {
            ViewData["Title"] = "Contact Us | Dubai JAFZA One Global Headquarters";
            return RenderSpaView("Contact");
        }

        public IActionResult Privacy()
        {
            ViewData["Title"] = "Privacy Policy & Website Analytics";
            return RenderSpaView("Privacy");
        }

        public IActionResult Quote()
        {
            ViewData["Title"] = "Instant Freight Quote | Real-time AI Estimator";
            return RenderSpaView("Quote", new QuoteRequestModel());
        }

        public IActionResult StaffLogin()
        {
            ViewData["Title"] = "Staff Login | LOTKA People Solutions Results";
            return RenderSpaView("StaffLogin");
        }

        [HttpPost]
        public IActionResult CalculateQuote([FromBody] QuoteRequestModel model)
        {
            if (model == null)
            {
                return BadRequest(new { success = false, message = "Invalid quote parameters" });
            }

            double ratePerKg = model.FreightType?.ToLower() switch
            {
                "air" => 17.50, // AED per kg
                "ocean" => 4.60, // AED per kg
                "land" => 7.80, // AED per kg
                _ => 11.00
            };

            double baseCost = Math.Max(450.0, model.WeightKg * ratePerKg);
            double fuelSurcharge = baseCost * 0.10;
            double customsFee = 165.0; // AED customs clearance
            double totalEstimate = Math.Round(baseCost + fuelSurcharge + customsFee, 2);

            string transitDays = model.FreightType?.ToLower() switch
            {
                "air" => "2 - 4 Business Days",
                "ocean" => "14 - 22 Business Days",
                "land" => "5 - 8 Business Days",
                _ => "3 - 7 Business Days"
            };

            return Json(new
            {
                success = true,
                estimate = totalEstimate,
                currency = "AED",
                transitTime = transitDays,
                summary = $"{model.FreightType} Freight from {model.Origin} to {model.Destination} ({model.WeightKg} kg)"
            });
        }

        [HttpGet]
        public IActionResult TrackShipment(string? number)
        {
            string trackingId = string.IsNullOrWhiteSpace(number) ? "LOTKA-8942-DXB" : number.Trim().ToUpper();

            var result = new ShipmentTrackingResult
            {
                TrackingNumber = trackingId,
                Status = "In Transit - On Schedule",
                Origin = "Jebel Ali Port (JAFZA), Dubai, UAE",
                Destination = "Port of Rotterdam, Netherlands",
                EstimatedDelivery = DateTime.UtcNow.AddDays(3).ToString("MMM dd, yyyy - 14:00 GST"),
                CurrentLocation = "Suez Canal Transit Corridor (Vessel: LOTKA NEBULA)",
                Carrier = "LOTKA Maritime AI Carrier",
                Checkpoints = new List<TrackingCheckpoint>
                {
                    new TrackingCheckpoint { Timestamp = "Oct 08, 09:30 GST", Location = "Jebel Ali JAFZA Hub", Description = "Cargo received, automated HS code cleared & customs verified", IsCompleted = true },
                    new TrackingCheckpoint { Timestamp = "Oct 09, 14:15 GST", Location = "Dubai DP World Terminal 2", Description = "Loaded onto vessel LOTKA NEBULA - Container #LOU782914", IsCompleted = true },
                    new TrackingCheckpoint { Timestamp = "Oct 11, 18:45 GST", Location = "Red Sea Waypoint 4", Description = "IoT sensor telemetry verified (Temperature: 18°C, Humidity: 42%)", IsCompleted = true },
                    new TrackingCheckpoint { Timestamp = "Oct 12, 10:20 GST", Location = "Suez Canal Corridor", Description = "Entering convoy; Autonomous dynamic routing active", IsCompleted = true },
                    new TrackingCheckpoint { Timestamp = "Oct 15, 14:00 CET", Location = "Port of Rotterdam", Description = "Scheduled final berth & multimodal delivery dispatch", IsCompleted = false }
                }
            };

            return Json(new { success = true, tracking = result });
        }

        [HttpPost]
        public IActionResult SubmitContact([FromBody] ContactRequestModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { success = false, message = "Please check all required fields." });
            }

            return Json(new
            {
                success = true,
                message = $"Thank you, {model.Name}. Your inquiry has been routed to our Dubai operations team and AI allocation manager. We will contact you at {model.Email} within 15 minutes."
            });
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
