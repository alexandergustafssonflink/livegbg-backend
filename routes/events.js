const router = require("express").Router();
const Events = require("../models/events.js");
const ExternalEvents = require("../models/external-event.js");
const authenticateToken = require("../middleware/auth.js");

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

    const externalEvents = await ExternalEvents.find();
    console.log("EXTERNAL", externalEvents);

    externalEvents.forEach((externalEvent) => {
      events[0].events.push({
        title: externalEvent.title,
        link: externalEvent.link,
        imageUrl: externalEvent.imageUrl,
        date: externalEvent.date,
        place: externalEvent.place,
        city: externalEvent.city,
      });
    });

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

router.get("/external", async (req, res) => {
  console.log("GETTING EXTERNAL EVENTS");
  try {
    const events = await ExternalEvents.find().sort({ _id: -1 });
    res.json(events);
  } catch (error) {
    res.send(error);
  }
});

router.post("/external", authenticateToken, async (req, res) => {
  try {
    const { title, date, imageUrl, link, songs } = req.body;

    // Kontrollera att vi har en autentiserad användare med ett `place`
    if (!req.user || !req.user.place) {
      return res
        .status(400)
        .json({ message: "Användarens plats är inte definierad." });
    }

    // Skapa ett nytt event med användarens `place`
    const newEvent = new ExternalEvents({
      title,
      date,
      imageUrl,
      link,
      songs,
      place: req.user.place,
    });

    // Spara eventet i databasen
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte skapa eventet.", error });
  }
});

router.delete("/external/:id", authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Kontrollera att vi har en autentiserad användare med ett `place`
    if (!req.user || !req.user.place) {
      return res
        .status(400)
        .json({ message: "Användarens plats är inte definierad." });
    }

    // Hitta eventet baserat på ID
    const event = await ExternalEvents.findById(eventId);

    // Om eventet inte hittas
    if (!event) {
      return res.status(404).json({ message: "Eventet hittades inte." });
    }

    // Kontrollera om användarens `place` är samma som eventets `place`
    if (event.place !== req.user.place) {
      return res
        .status(403)
        .json({ message: "Du har inte behörighet att ta bort detta event." });
    }

    // Radera eventet
    await event.remove();
    res.status(200).json({ message: "Eventet har raderats." });
  } catch (error) {
    res.status(500).json({ message: "Kunde inte radera eventet.", error });
  }
});

router.get("/external/my-events", authenticateToken, async (req, res) => {
  console.log("GETTING MY EVENTS");
  try {
    // Kontrollera att vi har en autentiserad användare med ett `place`
    if (!req.user || !req.user.place) {
      return res
        .status(400)
        .json({ message: "Användarens plats är inte definierad." });
    }

    const events = await ExternalEvents.find({ place: req.user.place }).sort({
      _id: -1,
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte skapa eventet.", error });
  }
});

module.exports = router;
