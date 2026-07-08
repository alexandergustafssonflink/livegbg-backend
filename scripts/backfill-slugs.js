/**
 * Engångs-backfill: sätter slug på alla befintliga Concert- och
 * ExternalEvent-dokument som saknar en.
 *
 * Körning (lokalt, mot samma DB som backend via .env):
 *   node scripts/backfill-slugs.js
 *
 * Säker att köra flera gånger — dokument som redan har slug rörs aldrig.
 * Nya dokument får slug automatiskt via pre-save-hooken i modellerna, så
 * detta behövs bara en gång för historisk data.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Concert = require("../models/concert.js");
const ExternalEvents = require("../models/external-event.js");
const { generateEventSlug } = require("../utils/eventSlug.js");

async function backfillCollection(Model, label) {
  const docs = await Model.find({
    $or: [{ slug: { $exists: false } }, { slug: null }],
  });

  let ok = 0;
  let skipped = 0;
  for (const doc of docs) {
    const slug = generateEventSlug(doc);
    if (!slug) {
      // saknar titel — går inte att bygga meningsfull slug
      skipped++;
      continue;
    }
    // updateOne istället för doc.save() så vi inte triggar validering av
    // gamla legacy-dokument som kan sakna numera-required fält.
    await Model.updateOne({ _id: doc._id }, { $set: { slug } });
    ok++;
  }
  console.log(`${label}: ${ok} slugs satta, ${skipped} skippade (saknar titel), ${docs.length} kandidater`);
}

async function main() {
  if (!process.env.DB_CONNECT) {
    console.error("DB_CONNECT saknas i .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.DB_CONNECT);
  console.log("Ansluten till DB");

  await backfillCollection(Concert, "Concert");
  await backfillCollection(ExternalEvents, "ExternalEvent");

  await mongoose.disconnect();
  console.log("Klart.");
}

main().catch((err) => {
  console.error("Backfill misslyckades:", err);
  process.exit(1);
});
