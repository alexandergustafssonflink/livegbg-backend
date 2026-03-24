async function getPotatisenEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.restaurang-potatisen.se/underhallning", {
    waitUntil: "networkidle2",
  });

  await page.waitForTimeout(2000);

  let events = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".animation-item"),
      (e) => {
        const h3s = e.querySelectorAll("h3");
        if (h3s.length < 3) return null;

        const title = h3s[0].textContent.trim();
        const category = h3s[1].textContent.trim();
        const dateText = h3s[2].textContent.trim();

        if (
          !category.toLowerCase().includes("koncert") &&
          !category.toLowerCase().includes("konsert")
        ) {
          return null;
        }

        const imgEl = e.querySelector("img");
        const linkEl = e.querySelector("a");

        return {
          title: title,
          link: linkEl ? linkEl.href : "",
          imageUrl: imgEl ? imgEl.src : "",
          date: dateText,
          place: "Potatisen",
          city: "Göteborg",
        };
      }
    )
  );

  events = events.filter((event) => event !== null);

  const monthMap = {
    "jan.": 1,
    "feb.": 2,
    "mars": 3,
    "mar.": 3,
    "apr.": 4,
    "maj": 5,
    "juni": 6,
    "juli": 7,
    "aug.": 8,
    "sep.": 9,
    "okt.": 10,
    "nov.": 11,
    "dec.": 12,
  };

  let year = new Date().getFullYear();
  const eventYears = [];

  for (let i = 0; i < events.length; i++) {
    const parts = events[i].date.split(" ");
    const month = monthMap[(parts[1] || "").toLowerCase()];
    const prevMonth =
      i > 0
        ? monthMap[(events[i - 1].date.split(" ")[1] || "").toLowerCase()]
        : null;

    if (i > 0 && month <= 4 && prevMonth >= 11) {
      year++;
    }
    eventYears.push(year);
  }

  for (let i = 0; i < events.length; i++) {
    const parts = events[i].date.split(" ");
    const day = Number(parts[0]);
    const month = monthMap[(parts[1] || "").toLowerCase()];

    if (day && month) {
      events[i].date = new Date(Date.UTC(eventYears[i], month - 1, day));
    }
  }

  await page.close();
  return events;
}

module.exports = getPotatisenEvents;
