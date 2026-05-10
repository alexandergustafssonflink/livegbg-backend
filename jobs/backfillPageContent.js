/**
 * CLI-skript för att backfilla pageContent (rå sidtext) på befintliga concerts.
 *
 * Använder den GENERISKA extractor:n — inga per-venue-selektorer.
 *
 * Användning:
 *   node jobs/backfillPageContent.js
 *   LIMIT=20 node jobs/backfillPageContent.js                  # max 20 events
 *   PLACES=Pustervik,Oceanen node jobs/backfillPageContent.js  # bara dessa venues
 *   DELAY=4000 node jobs/backfillPageContent.js                # 4s mellan requests
 *   ONE_PER_VENUE=1 node jobs/backfillPageContent.js           # en konsert per venue
 *   FORCE=1 node jobs/backfillPageContent.js                   # re-fetcha även befintliga
 *
 * Kombinera flaggor: FORCE=1 ONE_PER_VENUE=1 node jobs/...
 */
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const backfillPageContent = require("../utils/backfillPageContent");

// Ladda .env från projektroten oavsett varifrån scriptet körs
// (annars failar DB_CONNECT om man kör `node jobs/backfillPageContent.js`
// från jobs/-mappen).
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const limit = Number(process.env.LIMIT || 50);
  const delayMs = Number(process.env.DELAY || 2500);
  const places = process.env.PLACES
    ? process.env.PLACES.split(",").map((p) => p.trim()).filter(Boolean)
    : null;
  const onePerVenue =
    process.env.ONE_PER_VENUE === "1" || process.env.ONE_PER_VENUE === "true";
  const force = process.env.FORCE === "1" || process.env.FORCE === "true";

  console.log("[backfill-pageContent] Connecting to DB...");
  await mongoose.connect(process.env.DB_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("[backfill-pageContent] Launching browser...");
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  try {
    const result = await backfillPageContent(browser, {
      limit,
      delayMs,
      places,
      onePerVenue,
      force,
    });
    console.log("[backfill-pageContent] Done:", result);
  } catch (err) {
    console.error("[backfill-pageContent] Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

main();
