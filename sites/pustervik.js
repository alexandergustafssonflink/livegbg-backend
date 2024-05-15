async function getPustervikEvents(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto("https://pustervik.nu/", { waitUntil: "networkidle0" });
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
  await page.waitForTimeout(1000);
  const events = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".single.event"), (e) => {
      if (
        !e.querySelector("h2").textContent.toLowerCase().includes("event") &&
        !e
          .querySelector("h2")
          .textContent.toLowerCase()
          .includes("okategoriserad")
      ) {
        const div = e.querySelector(".img-holder");
        const style = window.getComputedStyle(div, false);
        const image = style.backgroundImage.slice(4, -1).replace(/"/g, "");
        return {
          title: e
            .querySelector("h2")
            .textContent.trim()
            .replace("konsert\n\t\t\t\t", ""),
          link: e.querySelector(".more-button").href,
          tickets: e.querySelector("a.button.tickets")
            ? e.querySelector("a.button.tickets").href
            : "",
          imageUrl: image,
          date: e
            .querySelector("time")
            .textContent.replace("idag ", "")
            .replace(/(\r\n|\n|\r)/gm, "")
            .replace("\t\t\t\t", "")
            .replace("\t\t\t\t", ""),
          place: "Pustervik",
        };
      }
    })
  );
  let fEvents = events.filter((event) => event !== null);
  let year = Number(new Date().toString().split(" ")[3]);
  for (let i = 0; i < fEvents.length; i++) {
    let event = fEvents[i];

    if (
      event.date.includes("januari") &&
      fEvents[i - 1]?.date.includes("december")
    ) {
      year++;
    }
    let newDate =
      year + " " + event.date.split(" ")[2] + " " + event.date.split(" ")[1];

    event.date = newDate;
  }

  for (let i = 0; i < fEvents.length; i++) {
    fEvents[i].date = fEvents[i].date
      .replace("januari", "1")
      .replace("februari", "2")
      .replace("mars", "3")
      .replace("april", "4")
      .replace("maj", "5")
      .replace("juni", "6")
      .replace("juli", "7")
      .replace("augusti", "8")
      .replace("september", "9")
      .replace("oktober", "10")
      .replace("november", "11")
      .replace("december", "12");
    let year = fEvents[i].date.split(" ")[0];
    let month = fEvents[i].date.split(" ")[1];
    let day = fEvents[i].date.split(" ")[2];
    fEvents[i].date = new Date(Date.UTC(year, month - 1, day));
  }
  await page.close();
  return fEvents;
}

module.exports = getPustervikEvents;
