async function getPotatisenEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.restaurang-potatisen.se/underhallning", {
    waitUntil: "networkidle2",
  });

  await page.waitForTimeout(2000);

  let events = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-hook="event-list-item"], .event-item, article.event, .event'
      ),
      (e) => {
        const titleEl =
          e.querySelector('[data-hook="ev-title"]') ||
          e.querySelector("h2") ||
          e.querySelector("h3");
        const dateEl =
          e.querySelector('[data-hook="ev-scheduled-buttons-rsvp-full"]') ||
          e.querySelector("time") ||
          e.querySelector(".date") ||
          e.querySelector(".event-date");
        const imgEl = e.querySelector("img");
        const linkEl = e.querySelector("a");

        if (!titleEl) return null;

        const title = titleEl.textContent.trim();
        if (
          title.toLowerCase().includes("standup") ||
          title.toLowerCase().includes("stand up") ||
          title.toLowerCase().includes("karaoke")
        ) {
          return null;
        }

        const dateText = dateEl
          ? dateEl.getAttribute("datetime") || dateEl.textContent.trim()
          : "";

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

  events = events.filter((event) => event !== null && event.date !== "");

  let year = new Date().getFullYear();

  for (let i = 0; i < events.length; i++) {
    const isIsoDate = /^\d{4}-\d{2}-\d{2}/.test(events[i].date);
    if (isIsoDate) {
      const parts = events[i].date.split("T")[0].split("-");
      events[i].date = new Date(
        Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      );
    } else {
      if (
        (events[i].date.toLowerCase().includes("jan") &&
          events[i - 1]?.date.toLowerCase().includes("dec")) ||
        (events[i].date.toLowerCase().includes("feb") &&
          events[i - 1]?.date.toLowerCase().includes("dec")) ||
        (events[i].date.toLowerCase().includes("mar") &&
          events[i - 1]?.date.toLowerCase().includes("dec")) ||
        (events[i].date.toLowerCase().includes("apr") &&
          events[i - 1]?.date.toLowerCase().includes("dec"))
      ) {
        year++;
      }
      let dateString = (year + " " + events[i].date)
        .replace("januari", "01")
        .replace("februari", "02")
        .replace("mars", "03")
        .replace("april", "04")
        .replace("maj", "05")
        .replace("juni", "06")
        .replace("juli", "07")
        .replace("augusti", "08")
        .replace("september", "09")
        .replace("oktober", "10")
        .replace("november", "11")
        .replace("december", "12");
      events[i].date = new Date(
        Date.UTC(
          dateString.split(" ")[0],
          dateString.split(" ")[2] - 1,
          dateString.split(" ")[1]
        )
      );
    }
  }

  await page.close();
  return events;
}

module.exports = getPotatisenEvents;
