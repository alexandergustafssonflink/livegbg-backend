async function getNefertitiEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://www.nefertiti.se");

  page.waitForNavigation({ waitUntil: "networkidle0" });

  const cookieCloseBtn = await page.waitForSelector("#cc-b-acceptall");
  await page.$eval("#cc-b-acceptall", (btn) => btn.click());
  await page.waitForTimeout(1000);
  const closeBtn = await page.waitForSelector(".popmake-close");
  await page.$eval(".popmake-close", (btn) => btn.click());
  //   const loadBtn = await page.waitForSelector(".load-more");
  //await page.$eval(".load-more", (btn) => btn.click());
  let loadBtn = await page.$(".load-more");
  if (loadBtn) {
    await page.$eval(".load-more", (btn) => btn.click());
  }

  await page.waitForTimeout(1000);
  let events = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".posts-nefertiti_event .spajder-post"),
      (e) => {
        const title = e.querySelector("h2").textContent;
        if (!title.includes("Colors")) {
          return {
            title: title,
            link: e.querySelector(".readmore").href,
            imageUrl: e.getElementsByTagName("img")[0].src,
            date: e.querySelector(".timestamp.heading").textContent,
            place: "Nefertiti",
          };
        }
      }
    )
  );
  events = events.filter((event) => event !== null);
  let year = Number(new Date().toString().split(" ")[3]);
  for (let i = 0; i < events.length; i++) {
    // events[i].date = events[i].date.replace(/\s\s+/g, ' ').split(" ")[1] + " " + events[i].date.split(" ")[2];
    events[i].date =
      events[i].date.replace(/\s\s+/g, " ").split(" ")[1] +
      " " +
      events[i].date.replace(/\s\s+/g, " ").split(" ")[2];

    if (
      (events[i].date.toLowerCase().includes("apr") &&
        events[i - 1]?.date.toLowerCase().includes("dec")) ||
      (events[i].date.toLowerCase().includes("mar") &&
        events[i - 1]?.date.toLowerCase().includes("dec")) ||
      (events[i].date.includes("feb") && events[i - 1]?.date.includes("dec")) ||
      (events[i].date.includes("jan") && events[i - 1]?.date.includes("dec"))
    ) {
      year++;
    }

    events[i].date = year + " " + events[i].date;
  }

  for (let i = 0; i < events.length; i++) {
    let dateString = events[i].date
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
  // await page.close();
  return events;
}

module.exports = getNefertitiEvents;
