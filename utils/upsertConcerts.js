const Concert = require("../models/concert");

/**
 * Tar emot en array av skrapade events och en stad. Skapar nya Concert-poster
 * eller uppdaterar befintliga baserat på en stabil matchningsnyckel.
 *
 * Matchningsstrategi (i prioritetsordning):
 *   1. place + link  - URL:en är typiskt stabil även om titeln ändras
 *      (t.ex. "Linkin park" -> "Linkin park + Soundgarden")
 *   2. place + samma datum - en venue har sällan flera events samma dag,
 *      MEN vi använder den här fallbacken bara när det är otvetydigt:
 *        - scrapen får inte ha flera events på samma place+date
 *        - DB:n får inte ha flera kandidater på samma place+date
 *        - titeln måste dela något ord med kandidatens titel (eller vara
 *          substring), så ett helt nytt event på samma dag inte krockar
 *
 * Events som inte längre dyker upp i en fetch markeras som inaktiva, men
 * BARA inom de venues som faktiskt returnerade minst ett event den här
 * körningen. Det förhindrar att en trasig scraper raderar all data för en
 * venue.
 */

function dayBoundsUtc(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function venueDayKey(place, date) {
  const bounds = dayBoundsUtc(date);
  if (!bounds) return null;
  return `${place}|${bounds.start.toISOString()}`;
}

function normalizeTitle(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 åäö]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Avgör om två titlar är "rimligt lika" - används som extra säkerhet i
 * date-fallbacken så vi inte mergar två helt orelaterade events som råkar
 * ligga samma dag på samma venue.
 */
function titlesLikelyMatch(a, b) {
  const A = normalizeTitle(a);
  const B = normalizeTitle(b);
  if (!A || !B) return false;
  if (A === B) return true;
  if (A.includes(B) || B.includes(A)) return true;

  const tokensA = new Set(A.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(B.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let common = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) common++;
  });
  const minSize = Math.min(tokensA.size, tokensB.size);
  return common / minSize >= 0.5;
}

async function upsertConcerts(scrapedEvents, city) {
  const fetchTime = new Date();
  const seenIds = [];
  const seenPlaces = new Set();

  // 1) Räkna hur många scrapade events som ligger på varje (place, date).
  //    Om >1 är place+date-fallbacken osäker för dessa - vi skippar den då.
  const scrapeVenueDayCount = new Map();
  for (const ev of scrapedEvents) {
    if (!ev || !ev.place || !ev.date) continue;
    const key = venueDayKey(ev.place, ev.date);
    if (!key) continue;
    scrapeVenueDayCount.set(key, (scrapeVenueDayCount.get(key) || 0) + 1);
  }

  for (const ev of scrapedEvents) {
    if (!ev || !ev.place) continue;
    seenPlaces.add(ev.place);

    let existing = null;

    // (a) Primär matchning: place + link
    if (ev.link) {
      existing = await Concert.findOne({ place: ev.place, link: ev.link });
    }

    // (b) Fallback: place + samma kalenderdag - men bara om det är otvetydigt
    if (!existing && ev.date) {
      const key = venueDayKey(ev.place, ev.date);
      const ambiguousInScrape =
        key && scrapeVenueDayCount.get(key) > 1; // flera scrapade events samma dag

      if (!ambiguousInScrape) {
        const bounds = dayBoundsUtc(ev.date);
        if (bounds) {
          const candidates = await Concert.find({
            place: ev.place,
            date: { $gte: bounds.start, $lt: bounds.end },
          });

          // Bara säkert om det finns exakt EN befintlig kandidat OCH
          // titeln är rimligt lik
          if (
            candidates.length === 1 &&
            titlesLikelyMatch(ev.title, candidates[0].title)
          ) {
            existing = candidates[0];
          }
        }
      }
    }

    if (existing) {
      // Uppdatera befintligt event med senaste data
      existing.title = ev.title ?? existing.title;
      existing.link = ev.link || existing.link;
      existing.imageUrl = ev.imageUrl || existing.imageUrl;
      existing.date = ev.date || existing.date;
      existing.tickets = ev.tickets ?? existing.tickets;
      existing.city = ev.city || city || existing.city;
      existing.lastSeenAt = fetchTime;
      // Återaktivera bara om eventet inte är permanent avaktiverat av AI:n
      // (t.ex. teater/comedy som klassats som icke-livemusik). Annars skulle
      // varje scrape återaktivera dessa events och göra LLM-arbetet meningslöst.
      if (!existing.isNotLiveMusic) {
        existing.isActive = true;
        existing.deactivatedAt = undefined;
      }

      await existing.save();
      seenIds.push(existing._id);
    } else {
      const created = await Concert.create({
        title: ev.title,
        link: ev.link,
        imageUrl: ev.imageUrl,
        date: ev.date,
        place: ev.place,
        tickets: ev.tickets,
        city: ev.city || city,
        firstSeenAt: fetchTime,
        lastSeenAt: fetchTime,
        isActive: true,
      });
      seenIds.push(created._id);
    }
  }

  // Avaktivera framtida events i scrapade venues som vi inte sett.
  if (seenPlaces.size > 0) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    await Concert.updateMany(
      {
        city,
        place: { $in: Array.from(seenPlaces) },
        isActive: true,
        _id: { $nin: seenIds },
        date: { $gte: todayStart },
      },
      { $set: { isActive: false, deactivatedAt: fetchTime } }
    );
  }

  return {
    upserted: seenIds.length,
    venues: seenPlaces.size,
  };
}

module.exports = upsertConcerts;
module.exports.titlesLikelyMatch = titlesLikelyMatch;
