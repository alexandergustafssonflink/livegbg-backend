const Concert = require("../models/concert");

/**
 * Tar emot en array av skrapade events och en stad. Skapar nya Concert-poster
 * eller uppdaterar befintliga baserat på en stabil matchningsnyckel.
 *
 * Matchningsstrategi (i prioritetsordning):
 *   1. venue + link  - URL:en är typiskt stabil även om titeln ändras
 *      (t.ex. "Linkin park" -> "Linkin park + Soundgarden")
 *   2. venue + kalenderdag + titel - används när link saknas eller ändrats.
 *        - Exakt (normaliserad) titelmatch används även om det finns flera
 *          kandidater samma dag; vi väljer då ÄLDSTA dokumentet så upprepade
 *          scrapes konvergerar mot samma post istället för att skapa dubbletter.
 *        - "Rimligt lik" titel (delat ord/substring) används bara när det är
 *          otvetydigt (exakt en kandidat), så olika events samma kväll inte
 *          mergas ihop.
 *      OBS: tidigare krävde fallbacken exakt EN kandidat även för identisk
 *      titel. Det gjorde att ett event med tom link (t.ex. gratis-events)
 *      duplicerades vid varje scrape — dubbletten kunde aldrig slås ihop igen.
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
  const seenVenues = new Set();

  for (const ev of scrapedEvents) {
    if (!ev || !ev.venue) continue;
    seenVenues.add(ev.venue);

    let existing = null;

    // (a) Primär matchning: venue + link (stabil när länken finns).
    if (ev.link) {
      existing = await Concert.findOne({ venue: ev.venue, link: ev.link });
    }

    // (b) Fallback när länken saknas eller ändrats: matcha på venue +
    //     kalenderdag + titel. Detta är skyddsnätet mot runaway-dubbletter:
    //     tidigare krävde fallbacken exakt EN befintlig kandidat, så fort en
    //     dubblett hade uppstått (t.ex. pga tom link) kunde den aldrig slå
    //     ihop igen och varje scrape skapade en ny post. Nu matchar vi på
    //     titel och väljer ÄLDSTA dokumentet, så upprepade scrapes alltid
    //     konvergerar mot samma post — även om en backlog av dubbletter finns.
    if (!existing && ev.date && ev.title) {
      const bounds = dayBoundsUtc(ev.date);
      if (bounds) {
        const sameDay = await Concert.find({
          venue: ev.venue,
          date: { $gte: bounds.start, $lt: bounds.end },
        });

        const evNorm = normalizeTitle(ev.title);

        // 1) Exakt (normaliserad) titelmatch — säkrast, och täcker det vanliga
        //    fallet där identisk titel scrapas om och om igen. Fungerar även
        //    med flera kandidater eftersom titeln är otvetydig.
        let matches = sameDay.filter((c) => normalizeTitle(c.title) === evNorm);

        // 2) Annars: en "rimligt lik" titel (t.ex. "Band" -> "Band + support"),
        //    men bara när det är otvetydigt (exakt en kandidat), så vi aldrig
        //    mergar ihop två olika events som råkar ligga samma kväll.
        if (matches.length === 0) {
          const fuzzy = sameDay.filter((c) =>
            titlesLikelyMatch(ev.title, c.title)
          );
          if (fuzzy.length === 1) matches = fuzzy;
        }

        if (matches.length > 0) {
          existing = matches.sort(
            (a, b) =>
              new Date(a.firstSeenAt || 0) - new Date(b.firstSeenAt || 0)
          )[0];
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
        venue: ev.venue,
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
  if (seenVenues.size > 0) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    await Concert.updateMany(
      {
        city,
        venue: { $in: Array.from(seenVenues) },
        isActive: true,
        _id: { $nin: seenIds },
        date: { $gte: todayStart },
      },
      { $set: { isActive: false, deactivatedAt: fetchTime } }
    );
  }

  return {
    upserted: seenIds.length,
    venues: seenVenues.size,
  };
}

module.exports = upsertConcerts;
module.exports.titlesLikelyMatch = titlesLikelyMatch;
