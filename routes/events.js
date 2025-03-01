const router = require("express").Router();
const dotenv = require("dotenv");
const Events = require("../models/events.js");
const ExternalEvents = require("../models/external-event.js");
const authenticateToken = require("../middleware/auth.js");
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs"); // För att ta bort lokala filer om du vill
dotenv.config();

const { getAllGbgEvents } = require("../gbg-scraper.js");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

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
        eventInfo: externalEvent.eventInfo,
        eventPrice: externalEvent.eventPrice,
        ticketLink: externalEvent.ticketLink,
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

router.post(
  "/external",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, date, link, songs, eventInfo, eventPrice, ticketLink } =
        req.body;
      if (!req.user || !req.user.place) {
        return res
          .status(400)
          .json({ message: "Användarens plats är inte definierad." });
      }

      let imageUrl = "";
      if (req.file) {
        console.log("Filen mottagen:", req.file);
        // Ladda upp filen till Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "events",
        });
        console.log("Cloudinary-resultat:", result);
        imageUrl = result.secure_url;
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Fel vid borttagning av lokala filen:", err);
        });
      }

      // Bygg event-data beroende på om en länk skickas med eller inte
      const eventData = {
        title,
        date,
        imageUrl,
        songs,
        place: req.user.place,
      };

      if (link && link.trim() !== "") {
        eventData.link = link;
      } else {
        eventData.eventInfo = eventInfo;
        eventData.eventPrice = eventPrice;
        eventData.ticketLink = ticketLink;
      }

      const newEvent = new ExternalEvents(eventData);
      const savedEvent = await newEvent.save();
      res.status(201).json(savedEvent);
    } catch (error) {
      console.error("Error vid skapande av event:", error);
      res
        .status(500)
        .json({ message: "Kunde inte skapa eventet.", error: error.message });
    }
  }
);

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
