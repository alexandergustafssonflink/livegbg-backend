const crypto = require("crypto");

/**
 * Genererar ett dagligt salt genom att HMAC:a hemlig nyckel + dagens datum (UTC).
 * Samma IP ger olika hash på olika dagar → omöjligt att spåra besökare
 * mellan dagar, men möjligt att räkna unika besökare inom en dag.
 */
function getDailySalt() {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const secret =
    process.env.ANALYTICS_SALT_SECRET || "livegbg-analytics-default-secret";
  return crypto.createHmac("sha256", secret).update(today).digest("hex");
}

/**
 * Hashar en IP-adress med dagens salt.
 * Resultatet kan inte reverseras till ursprunglig IP.
 *
 * @param {string} ip - Besökarens IP-adress
 * @returns {string} - Hexadecimal SHA-256-hash
 */
function hashVisitor(ip) {
  const salt = getDailySalt();
  return crypto.createHash("sha256").update(salt + ip).digest("hex");
}

module.exports = { hashVisitor };
