/**
 * Migration: byter fältnamnet `place` → `venue` på alla tre collections
 * (users, external-events, concerts) och normaliserar User.venue +
 * ExternalEvent.venue till trimmad lowercase.
 *
 * Concert.venue lämnas i sin scrapade case eftersom den används som
 * display-namn i publika flow:et ("Pustervik", inte "pustervik").
 *
 * Säkert att köra om - är idempotent:
 *   - $rename är no-op om fältet redan heter venue
 *   - updateMany på lowercase är no-op om värdet redan är normaliserat
 *
 * Kör manuellt EN GÅNG innan deploy av place→venue-koden:
 *   node jobs/renamePlaceToVenue.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const COLLECTIONS = ["users", "external-events", "concerts"];
const NORMALIZE_COLLECTIONS = ["users", "external-events"];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI eller MONGO_URI saknas i .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Ansluten till ${db.databaseName}`);

  for (const coll of COLLECTIONS) {
    const renameResult = await db
      .collection(coll)
      .updateMany(
        { place: { $exists: true } },
        { $rename: { place: "venue" } }
      );
    console.log(
      `[${coll}] rename place→venue: matched=${renameResult.matchedCount} modified=${renameResult.modifiedCount}`
    );
  }

  // Aggregation pipeline-update gör lowercase + trim in-place på alla docs.
  // Kräver MongoDB 4.2+.
  for (const coll of NORMALIZE_COLLECTIONS) {
    const normResult = await db.collection(coll).updateMany(
      { venue: { $type: "string" } },
      [
        {
          $set: {
            venue: {
              $toLower: { $trim: { input: "$venue" } },
            },
          },
        },
      ]
    );
    console.log(
      `[${coll}] normalize venue (trim+lower): matched=${normResult.matchedCount} modified=${normResult.modifiedCount}`
    );
  }

  await mongoose.disconnect();
  console.log("Klar.");
}

main().catch((err) => {
  console.error("Migration fel:", err);
  process.exit(1);
});
