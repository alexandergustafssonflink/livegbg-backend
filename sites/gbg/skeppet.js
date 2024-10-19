async function getSkeppetEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.skeppetgbg.se/?post_type=tribe_events");

  await page.waitForTimeout(1000);
  let events = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".tribe-events-calendar-list__event-wrapper"),
      (e) => {
        return {
          title: e
            .querySelector("h3 a")
            .textContent.replace("\n\t\t", "")
            .replace("\t", ""),
          link: e.querySelector("a").href,
          imageUrl: e.querySelector("img")?.src
            ? e.querySelector("img")?.src
            : "",
          date: e.querySelector("time").getAttribute("datetime"),
          place: "Skeppet",
          city: "Göteborg",
        };
      }
    )
  );

  events = events.filter((event) => event !== null);

  for (let i = 0; i < events.length; i++) {
    let event = events[i];
    const year = event.date.split("-")[0];
    const month = event.date.split("-")[1];
    const day = event.date.split("-")[2].split(" ")[0];

    event.date = new Date(Date.UTC(year, month - 1, day));
  }
  // await page.close();
  return events;
}

module.exports = getSkeppetEvents;
