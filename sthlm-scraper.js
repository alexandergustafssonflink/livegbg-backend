// const puppeteer = require('puppeteer');
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Events = require("./models/events");
const Artist = require("./models/artist");
const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const axios = require("axios");
const getDebaserEvents = require("./sites/sthlm/debaser");
const checkAndGetArtistInfo = require("./utils/checkAndGetArtistInfo");
const filterOutNonMusic = require("./utils/filterOutNonMusic");

dotenv.config();

async function getAllSthlmEvents() {
  dotenv.config();
  mongoose.connect(process.env.DB_CONNECT, () =>
    console.log("CONNECTED TO DB - STHLM")
  );

  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  console.log("GETTING DEBASER!");
  const debaserEvents = await getDebaserEvents(browser);

  console.log(debaserEvents);

  let allEvents = [...debaserEvents];

  console.log("FILTERING OUT NON MUSIC EVENTS");
  allEvents = filterOutNonMusic(allEvents);

  // console.log("CHECKING AND GETTING ARTIST INFO");
  // await checkAndGetArtistInfo(allEvents);

  console.log("CREATING EVENTS");
  const events = new Events({
    date: new Date(),
    events: allEvents,
    city: "Stockholm",
  });

  try {
    console.log("SAVING EVENTS");
    const savedEvents = await events.save();
    console.log("Done!");
  } catch (error) {
    console.log("PROBLEM");
    console.log(error);
  } finally {
    await browser.close();
    // process.exit();
  }
}

// test()
// const job = schedule.scheduleJob("0 */4 * * *", function () {
//   getAllEvents();
// });
// getAllSthlmEvents();
// const job = schedule.scheduleJob("*/5 * * * *", function () {
//   getAllEvents();
// });
module.exports.getAllSthlmEvents = getAllSthlmEvents;
