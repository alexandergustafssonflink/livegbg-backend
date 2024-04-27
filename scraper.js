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
const getPustervikEvents = require("./sites/pustervik");
const getOceanenEvents = require("./sites/oceanen");
const getMusikensHusEvents = require("./sites/musikens-hus");
const getNefertitiEvents = require("./sites/nefertiti");
const getValandEvents = require("./sites/valand");
const getTragarnEvents = require("./sites/tragarn");
const getSkeppetEvents = require("./sites/skeppet");
const checkAndGetArtistInfo = require("./utils/checkAndGetArtistInfo");
const filterOutNonMusic = require("./utils/filterOutNonMusic");

dotenv.config();

async function getAllEvents() {
  dotenv.config();
  mongoose.connect(process.env.DB_CONNECT, () =>
    console.log("CONNECTED TO DB")
  );

  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  console.log("GETTING PUSTERVIK!");
  const pustervikEvents = await getPustervikEvents(browser);

  console.log("GETTING OCEANEN!");
  const oceanenEvents = await getOceanenEvents(browser);

  console.log("GETTING MUSIKENS HUS!");
  const musikensHusEvents = await getMusikensHusEvents(browser);

  console.log("GETTING NEF!");
  const nefertitiEvents = await getNefertitiEvents(browser);

  console.log("GETTING VALAND!");
  const valandEvents = await getValandEvents(browser);

  console.log("GETTING TRÄGÅRN!");
  const tragarnEvents = await getTragarnEvents(browser);

  console.log("GETTING SKEPPET!!");
  const skeppetEvents = await getSkeppetEvents(browser);

  let allEvents = [
    ...pustervikEvents,
    ...oceanenEvents,
    ...musikensHusEvents,
    ...nefertitiEvents,
    ...valandEvents,
    ...tragarnEvents,
    ...skeppetEvents,
  ];

  console.log("FILTERING OUT NON MUSIC EVENTS");
  allEvents = filterOutNonMusic(allEvents);

  console.log("CHECKING AND GETTING ARTIST INFO");
  await checkAndGetArtistInfo(allEvents);

  console.log("CREATING EVENTS");
  const events = new Events({
    date: new Date(),
    events: allEvents,
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
const job = schedule.scheduleJob("0 */4 * * *", function () {
  getAllEvents();
});
// getAllEvents();
// const job = schedule.scheduleJob("*/5 * * * *", function () {
//   getAllEvents();
// });
module.exports.getAllEvents = getAllEvents;
