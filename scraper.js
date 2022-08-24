const puppeteer = require('puppeteer');
const mongoose = require("mongoose");
const dotenv = require("dotenv")
const Events = require("./models/events");
const { MongoClient } = require("mongodb");

async function getPustervikEvents(browser) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.goto("https://pustervik.nu/kalender/");
    const events = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        ".single.event"
        ),
        (e) =>
        { 
            if(e.querySelector("h2").textContent.includes('konsert')) {
                const div = document.querySelector('.img-holder')  
                const style = window.getComputedStyle(div, false)  
                const image = style.backgroundImage.slice(4, -1).replace(/"/g, "")
                return {
                    title: e.querySelector("h2").textContent.trim().replace("konsert\n\t\t\t\t", ""),
                    link: e.querySelector(".more-button").href,
                    tickets: e.querySelector("a.button.tickets")? e.querySelector("a.button.tickets").href : "",
                    imageUrl: image,
                    date: e.querySelector("time").getAttribute("data-alt"),
                    place: "Pustervik",
                } 
            }
        })   
  );
    filteredEvents = events.filter(event => event !== null)
    return filteredEvents
}

async function getOceanenEvents(browser) {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);
        await page.goto("https://www.oceanen.com/");

        const events = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            ".upcoming-events li"
            ),
            (e) =>
            { 
                const dateString = e.getElementsByTagName("time")[0].getAttribute("datetime");
                // const year = dateString.split("-")[0]
                // const month = dateString.split("-")[1]
                // const day = dateString.split("-")[2].split(" ")[0]

                return {
                    title: e.querySelector("h3").textContent,
                    link: e.querySelector("a").href,
                    imageUrl: e.getElementsByTagName("img")[0].getAttribute("data-src"),
                    date: dateString,
                    place: "Oceanen",
                }
            })   
      );
      for(let i = 0; i < events.length; i++) {
        let event = events[i];
        const year = event.date.split("-")[0]
        const month = event.date.split("-")[1]
        const day = event.date.split("-")[2].split(" ")[0]

        event.date = new Date(Date.UTC(year, month -1, day))
    }
    return events

} 

async function getMusikensHusEvents (browser) {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);
        await page.goto("https://www.musikenshus.se/kalender");

        const events = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            ".cmsnycontent-box"
            ),
            (e) =>
            { 
                if(e.querySelector(".cmscontent-date h4").textContent) {
                    return {
                        title: e.querySelector("h2").textContent,
                        link: e.querySelector("a").href,
                        imageUrl: e.getElementsByTagName("img")[0].src,
                        date: e.querySelector(".cmscontent-date h4").textContent + " " + e.querySelector(".cmscontent-date p").textContent,
                        place: "Musikens hus"
                    }
                }
   
            })   
      );
        let year = Number(new Date().toString().split(" ")[3]);
        for(let i = 0; i < events.length; i++) {
            events[i].date = events[i].date.split("/")[0]

            if(events[i].date.toLowerCase().includes("apr") && events[i - 1].date.toLowerCase().includes("dec") || events[i].date.toLowerCase().includes("mar") && events[i - 1].date.toLowerCase().includes("dec")|| events[i].date.includes("feb") && events[i - 1].date.includes("dec") || events[i].date.includes("jan") && events[i - 1].date.includes("dec")) {
            // if(events[i].date.includes("Apr") && events[i - 1].date.includes("Dec") || events[i].date.includes("Mar") && events[i - 1].date.includes("Dec")|| events[i].date.includes("Feb") && events[i - 1].date.includes("Dec") || events[i].date.includes("Jan") && events[i - 1].date.includes("Dec")) {
                year++
            }
            events[i].date = year + " " + events[i].date;
        }

        for(let i = 0; i < events.length; i++) {
            let dateString = events[i].date.replace("Jan", "01").replace("Feb", "02").replace("Mar", "03").replace("Apr", "04").replace("Maj", "05").replace("Jun", "06").replace("Jul", "07").replace("Aug", "08").replace("Sep", "09").replace("Okt", "10").replace("Nov","11").replace("Dec", "12");
            events[i].date = new Date(Date.UTC(dateString.split(" ")[0], dateString.split(" ")[2] -1, dateString.split(" ")[1]))
        }
        return events
    
       

}

async function getNefertitiEvents(browser) {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);
        await page.goto("https://www.nefertiti.se");

        const loadBtn = await page.waitForSelector('.load-more');
        await page.$eval('.load-more', btn => btn.click() );
        await page.waitForTimeout(1000);
        const events = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            ".posts-nefertiti_event .spajder-post"
            ),
            (e) =>
           
            { 
                return {
                    title: e.querySelector("h2").textContent,
                    link: e.querySelector(".readmore").href,
                    imageUrl: e.getElementsByTagName("img")[0].src,
                    date: e.querySelector(".timestamp.heading").textContent,
                    place: "Nefertiti"
                }
            })   
      );
        let year = Number(new Date().toString().split(" ")[3]);
        for(let i = 0; i < events.length; i++) {
            // events[i].date = events[i].date.replace(/\s\s+/g, ' ').split(" ")[1] + " " + events[i].date.split(" ")[2];
            events[i].date = events[i].date.replace(/\s\s+/g, ' ').split(" ")[1] + " " + events[i].date.replace(/\s\s+/g, ' ').split(" ")[2]

            if(events[i].date.toLowerCase().includes("apr") && events[i - 1].date.toLowerCase().includes("dec") || events[i].date.toLowerCase().includes("mar") && events[i - 1].date.toLowerCase().includes("dec")|| events[i].date.includes("feb") && events[i - 1].date.includes("dec") || events[i].date.includes("jan") && events[i - 1].date.includes("dec")) {
                year++
            }

            events[i].date = year + " " + events[i].date
        }

        for(let i = 0; i < events.length; i++) {
            let dateString = events[i].date.replace("januari", "01").replace("februari", "02").replace("mars", "03").replace("april", "04").replace("maj", "05").replace("juni", "06").replace("juli", "07").replace("augusti", "08").replace("september", "09").replace("oktober", "10").replace("november","11").replace("december", "12");
            events[i].date = new Date(Date.UTC(dateString.split(" ")[0], dateString.split(" ")[2] -1, dateString.split(" ")[1]))
        }
        
        return events
}

function formatPustervikEvents(events) {
    let year = Number(new Date().toString().split(" ")[3]);
    for (let i = 0; i < events.length; i++) {
        let event = events[i];

        if(event.date.includes("januari") && events[i - 1].date.includes("december")) {
            year++
        }
        let newDate = year + " " + event.date.split(" ")[2] + " " + event.date.split(" ")[1];

        event.date = newDate;
    }

    for (let i = 0; i < events.length; i++ ) {
        events[i].date = events[i].date.replace("januari", "1").replace("februari", "2").replace("mars", "3").replace("april", "4").replace("maj", "5").replace("juni", "6").replace("juli", "7").replace("augusti", "8").replace("september", "9").replace("oktober", "10").replace("november", "11").replace("december", "12");
        let year = events[i].date.split(" ")[0];
        let month = events[i].date.split(" ")[1]
        let day = events[i].date.split(" ")[2];
        events[i].date = new Date(Date.UTC(year, month -1, day))
    }
    return events;
}

async function getAllEvents() {
    dotenv.config();
    mongoose.connect(process.env.DB_CONNECT, 
    () => console.log("CONNECTED TO DB"));

    // const browser = await puppeteer.launch({
    //     headless: true,
    //     args: ["--no-sandbox", "--disable-setuid-sandbox"],
    //   });

        const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
    console.log("GETTING PUSTERVIK!");
    const pEvents = await getPustervikEvents(browser);
    console.log("FORMATTING PUSTERVIK!");
    const pustervikEvents = formatPustervikEvents(pEvents)
    console.log("GETTING OCEANEN!");
    const oceanenEvents = await getOceanenEvents(browser);

    console.log("GETTING MUSIKENS HUS!");

    const musikensHusEvents = await getMusikensHusEvents(browser);
    console.log("GETTING Nefertiti!");
    const nefertitiEvents = await getNefertitiEvents(browser);


    await browser.close();
    const allEvents = [ ...pustervikEvents, ...oceanenEvents, ...musikensHusEvents, ...nefertitiEvents ];

    const events = new Events({
        date: new Date(),
        events: allEvents
    });

    console.log("INSERTING!");

    try {
        const savedEvents = await events.save();
        console.log("Done!")
        // console.log(savedEvents);
    } catch (error) {
        console.log(error);
    }
    

    //CONNECTING TO DATABASE AND INSERTING
    // const client = new MongoClient(process.env.DB_CONNECT, {
    //     useUnifiedTopology: true,
    //   });
    // await client.connect();
    // const database =  client.db("konserter-gbg");
    // const collection = database.collection("konserter");

    // try {
    //     const res = await collection.insertOne(data)
    //     console.log(res);
    // } catch (error) {   
    //     console.log(error);
    //   }
}

// getAllEvents();

module.exports.getAllEvents = getAllEvents;
//console.log(allLinks);

    // for(let i = 0; i < allLinks.length; i++) {
    //     await page.goto(allLinks[i]);
    //     // await page.waitForNavigation({waitUntil: 'networkidle0'}) 
    //     await page.waitForSelector('.event-title')
    //     title = await page.evaluate(() => {
    //         return document.querySelector(".event-title").textContent
    //     })
    //     if(title.includes("Nattklubb") || title.includes('wrestling')) {
    //         continue;
    //     }
    //     date = await page.evaluate(() => {
    //         return document.querySelector("tbody tr:nth-child(2) td:nth-child(2)").textContent.trim()
    //     })

    //     time = await page.evaluate(() => {
    //         return document.querySelector("tbody tr:nth-child(4) td:nth-child(2)").textContent.trim()
    //     })

    //     price = await page.evaluate(() => {
    //         return document.querySelector("tbody tr:nth-child(5) td:nth-child(2)").textContent.trim()
    //     })
    //     let concert = {
    //         title: title,
    //         date: date,
    //         time: time,
    //         price: price
    //     }
    //     concerts.push(concert)
    // }
    