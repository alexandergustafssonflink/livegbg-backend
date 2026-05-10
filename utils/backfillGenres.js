const Concert = require("../models/concert");
const classifyGenre = require("./classifyGenre");
const SKIP_PLACES = require("./skipPlaces");

/**
 * Klassificera genre på concerts som har pageContent men ingen AI-genre än.
 *
 * Respekterar admin-tagging: events där genreSource === 'admin' skippas
 * alltid (admin har sista ordet).
 *
 * Hoppar över events som misslyckades klassificeras nyligen (inom ~7 dagar)
 * för att undvika onödig API-användning.
 *
 * @param {object} [options]
 * @param {number} [options.limit=100] - max antal events per körning
 * @param {string[]} [options.places] - om angivet, bara dessa venues
 * @param {boolean} [options.force=false] - re-klassa även events som redan har AI-genre
 * @param {string} [options.promptVersion] - om angivet tillsammans med force,
 *                                            re-klassa bara events som tagged med
 *                                            denna äldre version (eller äldre)
 * @param {number} [options.delayMs=200] - delay mellan API-anrop (rate limit safety)
 * @param {number} [options.failureRetryDays=7] - försök inte klassificera events som
 *                                                 misslyckades inom detta många dagar
 * @returns {Promise<{ classified: number, failed: number, notLiveMusic: number, total: number }>}
 */
async function backfillGenres(options = {}) {
  const {
    limit = 100,
    places = null,
    force = false,
    promptVersion = null,
    delayMs = 200,
    failureRetryDays = 7,
  } = options;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Cutoff för retry: om klassificering misslyckades inom failureRetryDays,
  // försök inte igen
  const failureRetryDate = new Date();
  failureRetryDate.setDate(failureRetryDate.getDate() - failureRetryDays);

  const query = {
    isActive: true,
    date: { $gte: todayStart },
    pageContent: { $exists: true, $nin: [null, ""] },
    // Admin-tagging override:as aldrig.
    genreSource: { $ne: "admin" },
    // Hoppa över events som inte är livemusik
    isNotLiveMusic: { $ne: true },
    // Hoppa över events som misslyckades klassificering nyligen
    $or: [
      { genreClassificationFailedAt: { $exists: false } },
      { genreClassificationFailedAt: null },
      { genreClassificationFailedAt: { $lt: failureRetryDate } },
    ],
    // Defense-in-depth: även om Potatisen aldrig skulle ha pageContent
    // (det filtreras i backfillPageContent), exkluderar vi explicit här
    // så ev. legacy-data inte kommer igenom.
    place: { $nin: SKIP_PLACES },
  };

  if (!force) {
    // Default: bara events som inte redan har en genre satt. Skyddar
    // även legacy admin-tagged events där genreSource inte hann sättas
    // (det började sättas först när admin-routern uppdaterades).
    // Notera: i Mongo matchar `genre: null` även dokument som saknar
    // fältet helt — så detta täcker både legacy-saknade och explicit null.
    query.genre = null;
  } else if (promptVersion) {
    // FORCE + PROMPT_VERSION: re-klassa bara events tagged med en äldre
    // prompt-version. Säker default eftersom genreSource:'admin' redan
    // skyddar mot override.
    query.$or = [
      { genrePromptVersion: { $exists: false } },
      { genrePromptVersion: null },
      { genrePromptVersion: { $ne: classifyGenre.PROMPT_VERSION } },
    ];
  }
  // FORCE utan PROMPT_VERSION: re-klassa allt (utom admin-taggade och
  // SKIP_PLACES). Använd försiktigt — kostar API-anrop på allt.

  if (places && places.length) query.place = { $in: places };

  const candidates = await Concert.find(query)
    .sort({ date: 1 })
    .limit(limit)
    .lean();

  console.log(
    `[backfill-genres] ${candidates.length} concerts to classify ` +
      `(model: ${classifyGenre.MODEL}, prompt: ${classifyGenre.PROMPT_VERSION})`
  );

  let classified = 0;
  let failed = 0;
  let notLiveMusic = 0;

  for (const concert of candidates) {
    try {
      const result = await classifyGenre(concert);

      // Om LLM bedömde att detta inte är livemusik, deaktivera det
      if (result.isNotLiveMusic) {
        await Concert.updateOne(
          { _id: concert._id },
          {
            $set: {
              isNotLiveMusic: true,
              isActive: false,
              deactivatedAt: new Date(),
              genreSource: "ai",
              genrePromptVersion: classifyGenre.PROMPT_VERSION,
              aiAnalyzedAt: new Date(),
            },
          }
        );
        notLiveMusic++;
        console.log(
          `[backfill-genres] 🚫 ${concert.place} - ${concert.title} → inte livemusik, deaktiverad`
        );
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }

      // Framgångsrik klassificering
      await Concert.updateOne(
        { _id: concert._id },
        {
          $set: {
            genre: result.genre,
            genreConfidence: result.confidence,
            genreSource: "ai",
            genrePromptVersion: classifyGenre.PROMPT_VERSION,
            aiAnalyzedAt: new Date(),
            // Rensa tidigare klassificeringfel
            genreClassificationFailedAt: null,
          },
        }
      );
      classified++;

      const conf = (result.confidence * 100).toFixed(0);
      const symbol = result.confidence >= 0.7 ? "✓" : "?";
      console.log(
        `[backfill-genres] ${symbol} ${concert.place} - ${concert.title} → ${result.genre || "null"} (${conf}%)`
      );
      // Logga reasoning för låga-confidence-fall så vi kan tweaka prompt:en
      if (result.confidence < 0.7) {
        console.log(`    "${result.reasoning}"`);
      }
    } catch (err) {
      failed++;
      // Märk klassificeringfel med timestamp så vi inte försöker igen snart
      await Concert.updateOne(
        { _id: concert._id },
        {
          $set: {
            genreClassificationFailedAt: new Date(),
          },
        }
      );
      console.warn(
        `[backfill-genres] ✗ ${concert.place} - ${concert.title}:`,
        err.message
      );
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return { classified, failed, notLiveMusic, total: candidates.length };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = backfillGenres;
