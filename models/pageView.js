const mongoose = require("mongoose");

/**
 * Lagrar en enskild sidvisning.
 *
 * GDPR-design:
 * - IP-adressen lagras ALDRIG i klartext.
 * - hashedVisitor    = SHA-256(dagligtSalt + ip)   → daglig unik-räkning i grafen.
 * - monthlyHash      = SHA-256(månadsligtSalt + ip) → exakt unik-räkning per månad.
 * - Dagligt salt: samma person ger ny hash varje dag → ingen cross-dag-spårning.
 * - Månadsvist salt: samma person ger samma hash under månaden → korrekt dedup.
 *   Nästa månad byts saltet → ingen cross-månad-spårning.
 * - Data raderas automatiskt efter 13 månader (se jobs/cleanupAnalytics.js).
 */
const pageViewSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    maxlength: 500,
  },
  hashedVisitor: {
    type: String,
    required: true,
  },
  // Månadsvist salt — för exakt deduplicering av unika besökare per månad.
  // Optional för bakåtkompatibilitet med befintlig data.
  monthlyHash: {
    type: String,
  },
  device: {
    type: String,
    enum: ["mobile", "desktop", "unknown"],
    default: "unknown",
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("PageView", pageViewSchema, "pageviews");
