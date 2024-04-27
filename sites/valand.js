async function getValandEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("http://valand.se/kalender/");

  await page.waitForTimeout(1000);
  let events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".event"), (e) => {
      // const div = e.querySelector('.img-holder')
      const style = window.getComputedStyle(e, false);
      const image = style.backgroundImage.slice(4, -1).replace(/"/g, "");
      const title = e.querySelector("h3").textContent;
      if (!title.includes("is here to stay")) {
        return {
          title: e.querySelector("h3").textContent,
          link: e.querySelector("a").href,
          imageUrl: image,
          date: e
            .querySelector("a :nth-child(3)")
            .textContent.trim()
            .replace(/(\r\n|\n|\r)/gm, "")
            .replace(",", ""),
          place: "Valand",
        };
      }
    })
  );

  events = events.filter((event) => event !== null);
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
        dateString.split(" ")[2],
        dateString.split(" ")[1] - 1,
        dateString.split(" ")[0]
      )
    );
  }
  // await page.close();
  return events;
}

module.exports = getValandEvents;
