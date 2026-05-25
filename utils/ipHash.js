const crypto = require("crypto");

const secret =
  process.env.ANALYTICS_SALT_SECRET || "livegbg-analytics-default-secret";

/**
 * Dagligt salt — används för att räkna unika besökare per dag i grafen.
 * Samma IP ger olika hash olika dagar → ingen cross-dag-spårning.
 */
function getDailySalt() {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return crypto.createHmac("sha256", secret).update("daily:" + today).digest("hex");
}

/**
 * Månadsvist salt — används för att räkna exakta unika besökare per månad.
 * Samma IP ger samma hash under hela månaden → korrekt deduplicering.
 * Nästa månad byts saltet → ingen cross-månad-spårning.
 */
function getMonthlySalt() {
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  return crypto.createHmac("sha256", secret).update("monthly:" + month).digest("hex");
}

/**
 * Hash för daglig unik-räkning.
 */
function hashVisitor(ip) {
  return crypto.createHash("sha256").update(getDailySalt() + ip).digest("hex");
}

/**
 * Hash för månadsvis unik-räkning.
 * Samma person → samma hash under hela månaden.
 */
function hashVisitorMonthly(ip) {
  return crypto.createHash("sha256").update(getMonthlySalt() + ip).digest("hex");
}

module.exports = { hashVisitor, hashVisitorMonthly };
