const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Events = require("./models/events");
const Artist = require("./models/artist");
const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const axios = require("axios");
const getPustervikEvents = require("./sites/gbg/pustervik");
const getOceanenEvents = require("./sites/gbg/oceanen");
const getMusikensHusEvents = require("./sites/gbg/musikens-hus");
const getNefertitiEvents = require("./sites/gbg/nefertiti");
const getValandEvents = require("./sites/gbg/valand");
const getTragarnEvents = require("./sites/gbg/tragarn");
const getSkeppetEvents = require("./sites/gbg/skeppet");
const getPotatisenEvents = require("./sites/gbg/potatisen");
// const checkAndGetArtistInfo = require("./utils/checkAndGetArtistInfo");
const filterOutNonMusic = require("./utils/filterOutNonMusic");
const upsertConcerts = require("./utils/upsertConcerts");

dotenv.config();

async function getAllGbgEvents() {
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

  console.log("GETTING POTATISEN!");
  const potatisenEvents = await getPotatisenEvents(browser);

  let allEvents = [
    ...pustervikEvents,
    ...oceanenEvents,
    ...musikensHusEvents,
    ...nefertitiEvents,
    ...valandEvents,
    ...tragarnEvents,
    ...skeppetEvents,
    ...potatisenEvents,
  ];

  console.log("FILTERING OUT NON MUSIC EVENTS");
  allEvents = filterOutNonMusic(allEvents);

  // console.log("CHECKING AND GETTING ARTIST INFO");
  // await checkAndGetArtistInfo(allEvents);

  try {
    console.log("UPSERTING CONCERTS");
    const result = await upsertConcerts(allEvents, "Göteborg");
    console.log(
      `Done! Upserted ${result.upserted} concerts across ${result.venues} venues.`
    );
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
  getAllGbgEvents();
});
//getAllGbgEvents();
// const job = schedule.scheduleJob("*/5 * * * *", function () {
//   getAllEvents();
// });
module.exports.getAllGbgEvents = getAllGbgEvents;
