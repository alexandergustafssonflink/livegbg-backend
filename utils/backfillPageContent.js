const Concert = require("../models/concert");
const extractPageContent = require("./extractPageContent");
const SKIP_PLACES = require("./skipPlaces");

/**
 * Hämta pageContent (rå sid-text) för aktiva, framtida concerts som saknar det.
 *
 * Använder den GENERISKA extractor:n — inga per-venue-selektorer. Throttlar
 * per venue så vi inte hamrar deras servrar med flera samtidiga requests.
 * Misslyckade hämtningar markeras med pageContentFetchFailedAt så vi inte
 * försöker igen direkt — vi väntar minst retryAfterDays innan retry.
 *
 * @param {object} browser - puppeteer browser instance (delas från scrapern)
 * @param {object} [options]
 * @param {number} [options.limit=50] - max antal events per körning
 * @param {number} [options.delayMs=2500] - delay mellan requests inom samma venue
 * @param {string[]} [options.places] - om angivet, bara dessa venues
 * @param {number} [options.retryAfterDays=7] - dagar att vänta innan retry av miss
 * @param {boolean} [options.onePerVenue=false] - hämta bara EN concert per venue
 * @param {boolean} [options.force=false] - ignorera befintligt pageContent och hämta om
 * @returns {Promise<{ fetched: number, failed: number, total: number }>}
 */
async function backfillPageContent(browser, options = {}) {
  const {
    limit = 50,
    delayMs = 2500,
    places = null,
    retryAfterDays = 7,
    onePerVenue = false,
    force = false,
  } = options;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const retryCutoff = new Date();
  retryCutoff.setUTCDate(retryCutoff.getUTCDate() - retryAfterDays);

  const query = {
    isActive: true,
    date: { $gte: todayStart },
    link: { $exists: true, $ne: "" },
    place: { $nin: SKIP_PLACES },
  };
  if (!force) {
    query.pageContent = { $in: [null, undefined, ""] };
    query.$or = [
      { pageContentFetchFailedAt: { $exists: false } },
      { pageContentFetchFailedAt: null },
      { pageContentFetchFailedAt: { $lt: retryCutoff } },
    ];
  }
  if (places && places.length) query.place = { $in: places };

  let candidates;
  if (onePerVenue) {
    const grouped = await Concert.aggregate([
      { $match: query },
      { $sort: { date: 1 } },
      { $group: { _id: "$place", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $limit: limit },
    ]);
    candidates = grouped;
  } else {
    candidates = await Concert.find(query)
      .sort({ date: 1 })
      .limit(limit)
      .lean();
  }

  console.log(
    `[backfill-pageContent] ${candidates.length} concerts to fetch ` +
      `(limit ${limit}, onePerVenue ${onePerVenue}, force ${force})`
  );

  let fetched = 0;
  let failed = 0;

  // Gruppera per venue så vi kan throttla per-venue (inte över hela)
  const byPlace = new Map();
  for (const c of candidates) {
    if (!byPlace.has(c.place)) byPlace.set(c.place, []);
    byPlace.get(c.place).push(c);
  }

  // Kör venues parallellt, throttla inom varje venue
  const venuePromises = Array.from(byPlace.entries()).map(
    async ([place, concerts]) => {
      for (const concert of concerts) {
        try {
          const pageContent = await extractPageContent(browser, concert.link);
          if (pageContent && pageContent.length >= 100) {
            await Concert.updateOne(
              { _id: concert._id },
              {
                $set: {
                  pageContent,
                  pageContentFetchedAt: new Date(),
                },
                $unset: { pageContentFetchFailedAt: "" },
              }
            );
            fetched++;
            console.log(
              `[backfill-pageContent] ✓ ${place} - ${concert.title} (${pageContent.length} chars)`
            );
          } else {
            await Concert.updateOne(
              { _id: concert._id },
              { $set: { pageContentFetchFailedAt: new Date() } }
            );
            failed++;
            console.log(
              `[backfill-pageContent] ✗ ${place} - ${concert.title} (no/too short content)`
            );
          }
        } catch (err) {
          await Concert.updateOne(
            { _id: concert._id },
            { $set: { pageContentFetchFailedAt: new Date() } }
          );
          failed++;
          console.warn(
            `[backfill-pageContent] ✗ ${place} - ${concert.title}:`,
            err.message
          );
        }

        if (delayMs > 0) await sleep(delayMs);
      }
    }
  );

  await Promise.all(venuePromises);

  return { fetched, failed, total: candidates.length };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = backfillPageContent;
