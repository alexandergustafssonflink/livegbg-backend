const router = require("express").Router();
const PageView = require("../models/pageView");
const { hashVisitor } = require("../utils/ipHash");
const authenticateToken = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

// Kända bots, crawlers och automatiseringsverktyg
const BOT_PATTERN =
  /bot|crawler|spider|googlebot|bingbot|yandex|baidu|duckduckbot|slurp|wget|curl|python-requests|java\/|httpclient|go-http|okhttp|scrapy/i;

/**
 * POST /api/analytics/pageview
 *
 * Öppen endpoint — ingen autentisering krävs.
 * Registrerar en sidvisning från frontend-SPA:n.
 *
 * Body: { path: string, device: "mobile" | "desktop" | "unknown" }
 *
 * GDPR: Ingen cookie sätts. IP hashas omedelbart och lagras aldrig i klartext.
 */
router.post("/pageview", async (req, res) => {
  try {
    // Filtrera bort bots
    const ua = req.headers["user-agent"] || "";
    if (BOT_PATTERN.test(ua)) {
      return res.sendStatus(204);
    }

    const { path, device } = req.body;

    if (!path || typeof path !== "string") {
      return res.sendStatus(400);
    }

    // Hämta IP — stöd för Heroku/proxy via X-Forwarded-For
    const rawIp =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.ip ||
      "0.0.0.0";

    const hashedVisitor = hashVisitor(rawIp);

    const allowedDevices = ["mobile", "desktop", "unknown"];
    const cleanDevice = allowedDevices.includes(device) ? device : "unknown";

    await PageView.create({
      path: path.substring(0, 500),
      hashedVisitor,
      device: cleanDevice,
      timestamp: new Date(),
    });

    return res.sendStatus(204);
  } catch (err) {
    console.error("[Analytics] POST /pageview error:", err);
    return res.sendStatus(500);
  }
});

/**
 * GET /api/analytics/summary
 *
 * Kräver inloggning som super-admin.
 * Returnerar daglig aggregering av sidvisningar och unika besökare.
 *
 * Query-params:
 *   from  YYYY-MM-DD  (default: 30 dagar sedan)
 *   to    YYYY-MM-DD  (default: idag)
 *
 * Response: [{ date: "2026-05-01", pageviews: 42, uniqueVisitors: 31 }, ...]
 */
router.get(
  "/summary",
  authenticateToken,
  requireRole("super-admin"),
  async (req, res) => {
    try {
      const { from, to } = req.query;

      const fromDate = from
        ? new Date(from + "T00:00:00.000Z")
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const toDate = to
        ? new Date(to + "T23:59:59.999Z")
        : new Date();

      if (isNaN(fromDate) || isNaN(toDate)) {
        return res.status(400).json({ message: "Ogiltigt datumformat." });
      }

      const results = await PageView.aggregate([
        {
          $match: {
            timestamp: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp",
                timezone: "Europe/Stockholm",
              },
            },
            pageviews: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$hashedVisitor" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            pageviews: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
          },
        },
        { $sort: { date: 1 } },
      ]);

      return res.json(results);
    } catch (err) {
      console.error("[Analytics] GET /summary error:", err);
      return res.status(500).json({ message: "Serverfel." });
    }
  }
);

module.exports = router;
