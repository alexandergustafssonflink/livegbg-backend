const router = require("express").Router();
const Concert = require("../models/concert.js");
const ExternalEvents = require("../models/external-event.js");

/**
 * GET /sitemap.xml
 *
 * Dynamisk sitemap för Google/Bing. Serveras från backend men exponeras på
 * https://www.livegbg.se/sitemap.xml via en rewrite i frontendens
 * vercel.json (sitemapen MÅSTE ligga på samma domän som URL:erna den
 * listar).
 *
 * Innehåll:
 *   - statiska sidor (/, /about, /for-organizers, /merch)
 *   - alla aktiva KOMMANDE events med slug (Concert + ExternalEvent).
 *     Passerade events tas ur sitemapen (sidorna lever kvar med 200 och
 *     "har varit"-läge, men vi ber inte Google indexera dem).
 *
 * Cachas i minnet i 1h — sitemapen behöver bara vara lika färsk som
 * scrape-cronen (2 ggr/dag).
 */

const BASE_URL = "https://www.livegbg.se";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

let cachedXml = null;
let cachedAt = 0;

function xmlEscape(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  let entry = `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n`;
  if (lastmod) entry += `    <lastmod>${lastmod}</lastmod>\n`;
  if (changefreq) entry += `    <changefreq>${changefreq}</changefreq>\n`;
  if (priority) entry += `    <priority>${priority}</priority>\n`;
  entry += "  </url>";
  return entry;
}

async function buildSitemapXml() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [concerts, externals] = await Promise.all([
    Concert.find(
      {
        isActive: true,
        isNotLiveMusic: { $ne: true },
        slug: { $exists: true, $ne: null },
        date: { $gte: todayStart },
      },
      { slug: 1, updatedAt: 1 }
    ).lean(),
    ExternalEvents.find(
      {
        slug: { $exists: true, $ne: null },
        date: { $gte: todayStart },
      },
      { slug: 1 }
    ).lean(),
  ]);

  const entries = [
    urlEntry(`${BASE_URL}/`, { changefreq: "daily", priority: "1.0" }),
    urlEntry(`${BASE_URL}/about`, { changefreq: "monthly", priority: "0.3" }),
    urlEntry(`${BASE_URL}/for-organizers`, {
      changefreq: "monthly",
      priority: "0.3",
    }),
    urlEntry(`${BASE_URL}/merch`, { changefreq: "monthly", priority: "0.2" }),
  ];

  for (const c of concerts) {
    entries.push(
      urlEntry(`${BASE_URL}/event/${c.slug}`, {
        lastmod: c.updatedAt
          ? new Date(c.updatedAt).toISOString().split("T")[0]
          : undefined,
        changefreq: "weekly",
        priority: "0.8",
      })
    );
  }
  for (const e of externals) {
    entries.push(
      urlEntry(`${BASE_URL}/event/${e.slug}`, {
        changefreq: "weekly",
        priority: "0.8",
      })
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join("\n") +
    "\n</urlset>"
  );
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const now = Date.now();
    if (!cachedXml || now - cachedAt > CACHE_TTL_MS) {
      cachedXml = await buildSitemapXml();
      cachedAt = now;
    }
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(cachedXml);
  } catch (error) {
    res.status(500).send("Sitemap generation failed");
  }
});

module.exports = router;
