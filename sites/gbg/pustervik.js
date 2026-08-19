// Pustervik bytte hemsida (aug 2026). Events ligger nu på /kalender och
// renderas klient-sida (DatoCMS + React). Korten visas som ett rutnät först
// när man klickat på "Visa som rutnät"-knappen, och bilderna lazy-laddas vid
// scroll. Den här scrapern återskapar exakt samma utdata-form som tidigare:
//   { title, link, tickets, imageUrl, date, venue, city }

const MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

// Körs i browser-kontext via page.evaluate. Får BARA referera window/document
// (ingen closure över Node-variabler), därför upprepas månadslistan här inne.
// Returnerar råa strängfält; datum-tolkning/år-rollover görs sen i Node.
function extractPustervikCardsInBrowser() {
  const MONTHS_UP = [
    "JANUARI",
    "FEBRUARI",
    "MARS",
    "APRIL",
    "MAJ",
    "JUNI",
    "JULI",
    "AUGUSTI",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const monthRe = new RegExp("(\\d{1,2})\\s+(" + MONTHS_UP.join("|") + ")", "i");

  const seen = new Set();
  const out = [];

  document.querySelectorAll('a[href*="/evenemang/"]').forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const link = a.href; // absolut URL i browsern
    if (seen.has(link)) return;

    // Kort-roten innehåller både länken (bild + titel) och meta-blocket
    // (datum, arrangör, pris, biljettknapp) som ligger som syskon till <a>.
    const root = a.closest(".group") || a.parentElement || a;

    const titleEl = a.querySelector("h3");
    const title = titleEl ? titleEl.textContent.trim() : "";
    if (!title) return;

    // Bild: den riktiga <picture><img> har en http-src (base64-plattformen
    // är aria-hidden). Faller tillbaka på största bilden i <source srcset>.
    let imageUrl = "";
    const realImg = a.querySelector('picture img[src^="http"], img[src^="http"]');
    if (realImg) {
      imageUrl = realImg.src;
    } else {
      const source = a.querySelector("picture source[srcset]");
      if (source) {
        const parts = source
          .getAttribute("srcset")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) {
          imageUrl = parts[parts.length - 1].split(/\s+/)[0];
        }
      }
    }

    // Datum-spannet är den meta-span vars text matchar "<dag> <MÅNAD>".
    let rawDate = "";
    const spans = root.querySelectorAll("span");
    for (const s of spans) {
      const t = s.textContent.trim();
      if (monthRe.test(t)) {
        rawDate = t;
        break;
      }
    }

    // Biljettlänk: <a> i kortet som pekar på tickster / har texten "Köp biljett".
    let tickets = "";
    const anchors = root.querySelectorAll("a[href]");
    for (const x of anchors) {
      const xh = x.href || "";
      if (/tickster|biljett|ticket/i.test(xh) || /köp\s*biljett/i.test(x.textContent)) {
        tickets = xh;
        break;
      }
    }

    seen.add(link);
    out.push({ title, link, tickets, imageUrl, rawDate });
  });

  return out;
}

// Tolkar råa kort till slutlig form med riktiga Date-objekt. Sköter år-rollover:
// kalendern listas kronologiskt, så när månaden "hoppar bakåt" (t.ex. dec -> jan)
// har vi passerat ett årsskifte.
function normalizePustervikEvents(rawEvents) {
  const monthRe = new RegExp("(\\d{1,2})\\s+(" + MONTHS.join("|") + ")", "i");
  const result = [];
  let year = new Date().getUTCFullYear();
  let prevMonth = null;

  for (const raw of rawEvents) {
    const m = raw.rawDate ? raw.rawDate.toLowerCase().match(monthRe) : null;
    if (!m) continue; // hoppa kort utan tolkbart datum

    const day = parseInt(m[1], 10);
    const monthIndex = MONTHS.indexOf(m[2]); // 0-baserat

    if (prevMonth !== null && monthIndex < prevMonth) {
      year++; // månaden gick bakåt => nytt år
    }
    prevMonth = monthIndex;

    result.push({
      title: raw.title,
      link: raw.link,
      tickets: raw.tickets || "",
      imageUrl: raw.imageUrl || "",
      date: new Date(Date.UTC(year, monthIndex, day)),
      venue: "Pustervik",
      city: "Göteborg",
    });
  }

  return result;
}

async function getPustervikEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://pustervik.nu/kalender", { waitUntil: "networkidle0" });

  // Byt till rutnätsvyn så att korten renderas med bilder. Knappen kan redan
  // vara aktiv (aria-pressed="true") – då gör vi inget.
  try {
    await page.waitForSelector('button[aria-label="Visa som rutnät"]', {
      timeout: 15000,
    });
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Visa som rutnät"]');
      if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
    });
  } catch (e) {
    // Knappen kunde inte hittas – fortsätt ändå, sidan kan redan visa rutnät.
  }

  // Vänta in att minst ett event-kort finns.
  try {
    await page.waitForSelector('a[href*="/evenemang/"]', { timeout: 15000 });
  } catch (e) {}

  // Lazy-load: scrolla igenom hela sidan så alla kort och bilder laddas in.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
  await page.waitForTimeout(1500);
  // Scrolla tillbaka upp (vissa lazy-loaders behöver ett andra svep).
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const rawEvents = await page.evaluate(extractPustervikCardsInBrowser);
  const events = normalizePustervikEvents(rawEvents);

  await page.close();
  return events;
}

module.exports = getPustervikEvents;
// Exporteras för enhetstest (körs mot jsdom med samma logik som i browsern).
module.exports.extractPustervikCardsInBrowser = extractPustervikCardsInBrowser;
module.exports.normalizePustervikEvents = normalizePustervikEvents;
