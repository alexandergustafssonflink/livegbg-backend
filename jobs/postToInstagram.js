/**
 * CLI: postar nya opostade events till Instagram (@livegbg.se).
 *
 * Användning:
 *   DRY_RUN=1 node jobs/postToInstagram.js   # visa vad som skulle postas
 *   node jobs/postToInstagram.js             # posta på riktigt
 *   LIMIT=1 node jobs/postToInstagram.js     # max 1 inlägg
 *   MAX_AGE_DAYS=7 node jobs/postToInstagram.js  # ta med events sedda senaste 7 dagarna
 */
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const postNewConcertsToInstagram = require("../utils/postToInstagram");

async function main() {
  if (!process.env.DB_CONNECT) throw new Error("DB_CONNECT saknas i .env");

  console.log("[instagram] Connecting to DB...");
  await mongoose.connect(process.env.DB_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const result = await postNewConcertsToInstagram({
      maxPerRun: Number(process.env.LIMIT || 5),
      maxAgeDays: Number(process.env.MAX_AGE_DAYS || 3),
      dryRun: process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true",
    });
    console.log("[instagram] Done:", result);
  } catch (err) {
    console.error("[instagram] Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
