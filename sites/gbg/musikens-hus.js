async function getMusikensHusEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.musikenshus.se/kalender");

  let events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".cmsnycontent-box"), (e) => {
      if (
        e.querySelector(".cmscontent-date h4").textContent &&
        !e
          .querySelector("h2")
          .textContent.toLowerCase()
          .includes("poetry slam") &&
        !e
          .querySelector("h2")
          .textContent.toLowerCase()
          .includes("poesi & prosa") &&
        !e.querySelector("h2").textContent.toLowerCase().includes("standup")
      ) {
        return {
          title: e.querySelector("h2").textContent,
          link: e.querySelector("a").href,
          imageUrl: e.getElementsByTagName("img")[0].src,
          date:
            e.querySelector(".cmscontent-date h4").textContent +
            " " +
            e.querySelector(".cmscontent-date p").textContent,
          place: "Musikens hus",
          city: "Göteborg",
        };
      }
    })
  );

  events = events.filter((event) => event !== null);
  let year = Number(new Date().toString().split(" ")[3]);
  for (let i = 0; i < events.length; i++) {
    events[i].date = events[i].date.split("/")[0];

    if (
      (events[i].date.toLowerCase().includes("apr") &&
        events[i - 1]?.date.toLowerCase().includes("dec")) ||
      (events[i].date.toLowerCase().includes("mar") &&
        events[i - 1]?.date.toLowerCase().includes("dec")) ||
      (events[i].date.toLowerCase().includes("feb") &&
        events[i - 1]?.date.toLowerCase().includes("dec")) ||
      (events[i].date.toLowerCase().includes("jan") &&
        events[i - 1]?.date.toLowerCase().includes("dec"))
    ) {
      // if(events[i].date.includes("Apr") && events[i - 1].date.includes("Dec") || events[i].date.includes("Mar") && events[i - 1].date.includes("Dec")|| events[i].date.includes("Feb") && events[i - 1].date.includes("Dec") || events[i].date.includes("Jan") && events[i - 1].date.includes("Dec")) {
      year++;
    }
    events[i].date = year + " " + events[i].date;
  }

  for (let i = 0; i < events.length; i++) {
    let dateString = events[i].date
      .replace("Jan", "01")
      .replace("Feb", "02")
      .replace("Mar", "03")
      .replace("Apr", "04")
      .replace("Maj", "05")
      .replace("Jun", "06")
      .replace("Jul", "07")
      .replace("Aug", "08")
      .replace("Sep", "09")
      .replace("Okt", "10")
      .replace("Nov", "11")
      .replace("Dec", "12");
    events[i].date = new Date(
      Date.UTC(
        dateString.split(" ")[0],
        dateString.split(" ")[2] - 1,
        dateString.split(" ")[1]
      )
    );
  }
  // await page.close();
  return events;
}

module.exports = getMusikensHusEvents;
