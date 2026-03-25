async function getTragarnEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.tradgarn.se/konsert/kalender/");

  await page.waitForTimeout(1000);
  let events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".list-view .calendar-col"), (e) => {
      return {
        title: e.querySelector(".name").textContent,
        link: e.querySelector("a").href,
        imageUrl: (() => {
          const img = e.querySelector(".image img");
          let url = img.getAttribute("data-src") || img.src;
          // Parse srcset to find the highest-resolution image available
          const srcset = img.getAttribute("srcset");
          if (srcset) {
            let maxWidth = 0;
            for (const source of srcset.split(",").map((s) => s.trim()).filter(Boolean)) {
              const parts = source.split(/\s+/);
              if (parts.length >= 2) {
                const width = parseInt(parts[1]); // parts[1] is e.g. "1024w"
                if (!isNaN(width) && width > maxWidth) {
                  maxWidth = width;
                  url = parts[0];
                }
              }
            }
          }
          // Strip WordPress size suffix (e.g., -300x200.jpg → .jpg) to get full-size original
          return url.replace(/-\d+x\d+(\.\w+)$/, "$1");
        })(),
        date: e.querySelector(".date").textContent,
        place: "Trägårn",
        city: "Göteborg",
      };
    })
  );

  events = events.filter((event) => event !== null);

  for (let i = 0; i < events.length; i++) {
    let event = events[i];
    let parts = event.date.split("/");
    let date = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));

    event.date = date;
  }
  console.log(events);

  return events;
}

module.exports = getTragarnEvents;
