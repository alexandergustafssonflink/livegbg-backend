const mongoose = require("mongoose");

/**
 * Lagrar en enskild sidvisning.
 *
 * GDPR-design:
 * - IP-adressen lagras ALDRIG i klartext.
 * - hashedVisitor = SHA-256(dagligtSalt + ip) — kan inte reverseras.
 * - Dagligt roterande salt gör att samma besökare får olika hash olika dagar
 *   → ingen cross-dag-spårning av individer.
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
