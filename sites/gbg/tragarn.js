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
        imageUrl: e.querySelector(".image img").src,
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
