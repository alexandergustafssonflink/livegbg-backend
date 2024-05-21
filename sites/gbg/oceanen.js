async function getOceanenEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.oceanen.com/");

  let events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".upcoming-events li"), (e) => {
      if (!e.querySelector("h3")?.textContent) return null;
      if (
        !e.querySelector("h3").textContent.includes("Studentradio") &&
        !e.querySelector("h3").textContent.includes("Standup")
      ) {
        const dateString = e
          .getElementsByTagName("time")[0]
          .getAttribute("datetime");
        // const year = dateString.split("-")[0]
        // const month = dateString.split("-")[1]
        // const day = dateString.split("-")[2].split(" ")[0]

        return {
          title: e.querySelector("h3").textContent,
          link: e.querySelector("a").href,
          imageUrl: e.getElementsByTagName("img")[0].getAttribute("data-src"),
          date: dateString,
          place: "Oceanen",
          city: "Göteborg",
        };
      }
    })
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

module.exports = getOceanenEvents;
