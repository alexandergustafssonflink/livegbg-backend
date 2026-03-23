// getValandEvents.js
async function getValandEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);

  try {
    await page.goto("https://valand.se/kalender/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Plocka ut rådata från DOM (inkl. andra <h4> som innehåller datum-texten)
    let rawEvents = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".event"));
      return nodes
        .map((e) => {
          const style = window.getComputedStyle(e, false);
          const bg = style.backgroundImage || "";
          const image = bg ? bg.slice(4, -1).replace(/"/g, "") : null;

          const titleEl = e.querySelector("h3");
          const linkEl = e.querySelector("a");
          const h4s = Array.from(e.querySelectorAll("h4"));

          const title = titleEl?.textContent?.trim() || "";
          if (!title || title.includes("is here to stay")) return null;

          // Andra h4:an = datumet
          const dateText = h4s?.[1]?.textContent ?? "";
          return {
            title,
            link: linkEl?.href || null,
            imageUrl: image,
            dateText: dateText.replace(/(\r\n|\n|\r)/gm, "").trim(),
            place: "Valand",
            city: "Göteborg",
          };
        })
        .filter(Boolean);
    });

    // Hjälpare för månadsnamn (eng + sv)
    const MONTHS = {
      january: 0, februari: 1, february: 1, mars: 2, march: 2, april: 3,
      maj: 4, may: 4, juni: 5, june: 5, juli: 6, july: 6, augusti: 7, august: 7,
      september: 8, oktober: 9, october: 9, november: 10, december: 11, december: 11,
    };

    const normalize = (s) =>
      String(s || "")
        .replace(/\u2013|\u2014/g, "–") // en/em dash -> en dash
        .replace(/\s+/g, " ")
        .replace(/,\s*/g, ", ")
        .trim();

    const parseDay = (token) => {
      const n = parseInt(token, 10);
      return Number.isFinite(n) ? n : NaN;
    };

    const parseMonth = (token) => {
      if (!token) return NaN;
      const key = token.toLowerCase();
      return Object.prototype.hasOwnProperty.call(MONTHS, key) ? MONTHS[key] : NaN;
    };

    // Försök tolka sträng som "9 October, 2025" eller "9 October 2025" eller "9 oktober 2025"
    const parseSingleDate = (str, fallback = {}) => {
      const s = normalize(str).replace(",", "");
      const parts = s.split(" "); // [day, month, (year?)]
      if (parts.length < 2) return null;

      const day = parseDay(parts[0]);
      const month = parseMonth(parts[1]);
      const year = parts[2] ? parseInt(parts[2], 10) : fallback.year;

      if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
      // Skapa UTC-datum
      return new Date(Date.UTC(year, month, day));
    };

    // Bygg en lista med datum mellan start och slut (inklusive)
    const enumerateDates = (start, end) => {
      const out = [];
      let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      while (d <= last) {
        out.push(new Date(d));
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return out;
    };

    const expandEventDates = (evt) => {
      // dateText kan vara:
      // - "9 October, 2025"
      // - "10 October – 11 October, 2025"
      // - "28 December 2025 – 2 January, 2026"
      // Normalisera
      const txt = normalize(evt.dateText).replace(/,\s*/g, ", ").replace(/,/g, ""); // ta bort komma i år
      const hasDash = txt.includes("–") || txt.includes("-");
      const DASH = "–";
      const safe = txt.replace("-", DASH);

      if (!hasDash) {
        // Single date
        // Försök hitta årtal
        const yearMatch = safe.match(/\b(20\d{2}|\d{4})\b/);
        const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;
        const d = parseSingleDate(safe, { year });
        return d ? [d] : [];
      }

      // Range: dela på första "–"
      const [left, right] = safe.split(DASH).map((s) => s.trim());
      if (!left || !right) return [];

      // Hitta år i höger del
      const yearMatchRight = right.match(/\b(20\d{2}|\d{4})\b/);
      const yearRight = yearMatchRight ? parseInt(yearMatchRight[0], 10) : undefined;

      // Om höger saknar månad, försök hitta i höger, annars tolka
      const rightParts = right.split(" ");
      const rightHasMonth = Number.isFinite(parseMonth(rightParts[1]));
      const rightDate = parseSingleDate(right, { year: yearRight });

      // Vänster kan sakna år (och ibland månad vid format som "10 – 11 October, 2025", men sajten verkar ange månad på båda eller åtminstone på höger)
      // Försök parsa vänster med fallback till höger mån/år
      let leftDate;
      const leftParts = left.split(" ");
      if (leftParts.length === 1 && rightHasMonth) {
        // typ "10 – 11 October 2025": vänster bara dag
        const fallback = {
          year: yearRight,
          month: parseMonth(rightParts[1]),
        };
        const day = parseDay(leftParts[0]);
        if (Number.isFinite(day) && Number.isFinite(fallback.month) && Number.isFinite(fallback.year)) {
          leftDate = new Date(Date.UTC(fallback.year, fallback.month, day));
        }
      } else {
        leftDate = parseSingleDate(left, { year: yearRight });
      }

      if (!leftDate || !rightDate) return [];

      // Bygg lista
      const days = enumerateDates(leftDate, rightDate);
      return days;
    };

    const events = [];
    for (const evt of rawEvents) {
      try {
        const dates = expandEventDates(evt);

        // skip om mer än 4 datum i följd
        if (dates.length > 4) continue;
        if (dates.length === 0) {
          console.warn(`[Valand] Kunde inte tolka datum: "${evt.dateText}" för "${evt.title}"`);
          continue;
        }

        for (const d of dates) {
          events.push({
            title: evt.title,
            link: evt.link,
            imageUrl: evt.imageUrl,
            date: d, // Date (UTC)
            place: evt.place,
            city: evt.city,
          });
        }
      } catch (err) {
        console.error(`[Valand] Fel vid datumhantering för "${evt.title}" (${evt.dateText}):`, {
          message: err?.message,
        });
      }
    }

    // valfritt: await page.close();
    return events;
  } catch (err) {
    console.error("[Valand] Fel vid hämtning av kalendern:", {
      message: err?.message,
      stack: err?.stack,
    });
    // valfritt: await page.close();
    return [];
  }
}

module.exports = getValandEvents;
