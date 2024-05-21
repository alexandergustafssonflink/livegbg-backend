const router = require("express").Router();
const Events = require("../models/events.js");

const { getAllGbgEvents } = require("../gbg-scraper.js");

router.get("/getgbgevents", async (req, res) => {
  try {
    await getAllEvents();
    res.send("Done");
  } catch (error) {
    res.send(error);
  }
});

router.get("/gbg", async (req, res) => {
  try {
    const events = await Events.find({ city: "Göteborg" })
      .sort({ _id: -1 })
      .limit(1);

    res.json(events);
  } catch (error) {
    res.send(error);
  }
});

router.get("/sthlm", async (req, res) => {
  try {
    const events = await Events.find({ city: "Stockholm" })
      .sort({ _id: -1 })
      .limit(1);
    res.json(events);
  } catch (error) {
    res.send(error);
  }
});

module.exports = router;
