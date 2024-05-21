async function getDebaserEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.debaser.se/kalender/", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector(".event-image img");

  let events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".calendar-list a"), (e) => {
      if (!e.querySelector("h4")?.textContent) return null;
      if (!e.querySelector("h4").textContent.includes("Standup")) {
        const dateString = e
          .getElementsByTagName("time")[0]
          .getAttribute("datetime");
        // const year = dateString.split("-")[0]
        // const month = dateString.split("-")[1]
        // const day = dateString.split("-")[2].split(" ")[0]
        const imageElement = e.querySelector(".event-image img");
        const imageUrl = imageElement ? imageElement.src : null;

        return {
          title: e.querySelector("h4").textContent,
          link: e.href,
          imageUrl: imageUrl,
          date: dateString,
          place: "Debaser",
          city: "Stockholm",
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

module.exports = getDebaserEvents;
