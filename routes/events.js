const router = require("express").Router();
const Events = require("../models/events.js");

const { getAllEvents } = require("../scraper.js")

router.get("/getevents", async (req, res) => {
    try {
        await getAllEvents();
        res.send("Done")
    } catch (error) {
        res.send(error)
    }
})


router.get("/", async (req, res) => {
    try {
        const events = await Events.find({}).sort({_id:-1}).limit(1);
        console.log(events)
        res.json(events)
    } catch (error) {
        res.send(error)
    }
})


module.exports = router;