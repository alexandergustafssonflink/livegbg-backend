/**
 * Slug-generering för event-URL:er (/event/:slug på frontend).
 *
 * Format: {titel}-{venue}-{YYYY-MM-DD}-{4 sista hex-tecknen av _id}
 *   ex: hurula-pustervik-2026-08-12-a3f9
 *
 * Id-suffixet garanterar unikhet utan separat kollisionshantering och gör
 * uppslag robust: sluggen sätts EN gång (pre-save när den saknas) och ändras
 * aldrig, även om titeln uppdateras vid omscrape — delade/indexerade länkar
 * får inte ruttna.
 */

function slugifyPart(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é|è|ê/g, "e")
    .replace(/ü/g, "u")
    // allt som inte är a-z/0-9 blir bindestreck
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDateUtc(date) {
  // new Date(null) blir epoch (1970-01-01) — behandla saknat datum som null
  if (date == null) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Bygger slug från ett Concert-/ExternalEvent-dokument (kräver _id, dvs
 * anropas i pre-save — Mongoose sätter _id redan vid konstruktion).
 * Returnerar null om obligatoriska delar saknas.
 */
function generateEventSlug(doc) {
  if (!doc || !doc._id) return null;

  // Begränsa titeldelen så URL:er inte blir absurt långa vid
  // "A + B + C + support"-titlar. Klipp på ordgräns.
  let titlePart = slugifyPart(doc.title).slice(0, 60);
  titlePart = titlePart.replace(/-[^-]*$/, (m) =>
    titlePart.length === 60 ? "" : m
  );

  const venuePart = slugifyPart(doc.venue);
  const datePart = formatDateUtc(doc.date);
  const idPart = doc._id.toString().slice(-4);

  const parts = [titlePart, venuePart, datePart, idPart].filter(Boolean);
  // titel eller venue kan saknas i trasig scrape-data — id-delen räcker
  // alltid för unikhet, men kräver minst titel för en meningsfull slug.
  if (!titlePart) return null;

  return parts.join("-");
}

module.exports = { generateEventSlug, slugifyPart };
