/**
 * CLI: kör genre-klassning på events som har pageContent men ingen AI-genre.
 *
 * Användning:
 *   node jobs/backfillGenres.js
 *   LIMIT=50 node jobs/backfillGenres.js                  # max 50 events
 *   PLACES=Pustervik,Oceanen node jobs/backfillGenres.js  # bara dessa venues
 *   FORCE=1 node jobs/backfillGenres.js                   # re-klassa även AI-taggade
 *                                                          (admin-taggade skyddas alltid)
 *   FORCE=1 PROMPT_VERSION=1 node jobs/backfillGenres.js  # re-klassa bara events
 *                                                          taggade med äldre prompt
 *   DELAY=500 node jobs/backfillGenres.js                 # ms mellan API-anrop
 */
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const backfillGenres = require("../utils/backfillGenres");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const limit = Number(process.env.LIMIT || 100);
  const delayMs = Number(process.env.DELAY || 200);
  const places = process.env.PLACES
    ? process.env.PLACES.split(",").map((p) => p.trim()).filter(Boolean)
    : null;
  const force = process.env.FORCE === "1" || process.env.FORCE === "true";
  const promptVersion = process.env.PROMPT_VERSION || null;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY saknas i .env");
  }
  if (!process.env.DB_CONNECT) {
    throw new Error("DB_CONNECT saknas i .env");
  }

  console.log("[backfill-genres] Connecting to DB...");
  await mongoose.connect(process.env.DB_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const result = await backfillGenres({
      limit,
      delayMs,
      places,
      force,
      promptVersion,
    });
    console.log("[backfill-genres] Done:", result);
  } catch (err) {
    console.error("[backfill-genres] Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
