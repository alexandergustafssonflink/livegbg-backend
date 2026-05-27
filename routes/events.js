const router = require("express").Router();
const dotenv = require("dotenv");
const Events = require("../models/events.js");
const Concert = require("../models/concert.js");
const ExternalEvents = require("../models/external-event.js");
const authenticateToken = require("../middleware/auth.js");
const requireRole = require("../middleware/requireRole.js");
const GENRES = require("../utils/genres.js");
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

/**
 * GET /api/events/genres
 * Publik lista över giltiga genrer. Används av admin-UI (både super-admin
 * och organizer) för att populera dropdown:s, och bör hållas i synk med
 * Concert/ExternalEvent-modellernas enum (via samma utils/genres-fil).
 */
router.get("/genres", (req, res) => {
  res.json(GENRES);
});

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
    const concerts = await Concert.find(
      { city: "Göteborg", isActive: true },
      {
        title: 1,
        link: 1,
        imageUrl: 1,
        date: 1,
        venue: 1,
        city: 1,
        tickets: 1,
        genre: 1,
        genreConfidence: 1,
        genreSource: 1,
        highlighted: 1,
      }
    )
      .sort({ date: 1 })
      .lean();

    const externalEvents = await ExternalEvents.find();
    console.log("EXTERNAL", externalEvents);

    const merged = [...concerts];
    externalEvents.forEach((externalEvent) => {
      merged.push({
        _id: externalEvent._id,
        title: externalEvent.title,
        link: externalEvent.link,
        imageUrl: externalEvent.imageUrl,
        date: externalEvent.date,
        venue: externalEvent.venue,
        city: externalEvent.city,
        eventInfo: externalEvent.eventInfo,
        eventPrice: externalEvent.eventPrice,
        ticketLink: externalEvent.ticketLink,
        genre: externalEvent.genre,
        // External events har manuellt satta genrer (ingen AI-klassning),
        // så vi flaggar källan som 'admin' så shouldShowGenre släpper igenom
        // dem utan att kolla confidence.
        genreSource: externalEvent.genre ? "admin" : null,
        // External events kan inte favoritmarkeras än så länge - bara Concerts.
        // Vi flaggar typen så frontend kan dölja favorit-knappen vid behov.
        _isExternal: true,
      });
    });

    // Behåll samma response-form som tidigare så frontend slipper ändras:
    // en array med ett objekt som har `events`-arrayen i sig.
    res.json([
      {
        city: "Göteborg",
        date: new Date(),
        events: merged,
      },
    ]);
  } catch (error) {
    res.send(error);
  }
});

/**
 * GET /api/events/highlighted/:city
 * Publik endpoint för karusellen - returnerar highlighted, aktiva,
 * framtida event för angiven stad, sorterade på datum. Slår ihop scrapade
 * konserter (Concert) och organizer-skapade external events (ExternalEvent).
 * External events filtreras inte på city för tillfället - vi har bara
 * Göteborg och alla organizers ligger där.
 */
router.get("/highlighted/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const concerts = await Concert.find(
      {
        city,
        highlighted: true,
        isActive: true,
        date: { $gte: todayStart },
      },
      {
        title: 1,
        link: 1,
        imageUrl: 1,
        date: 1,
        venue: 1,
        city: 1,
        tickets: 1,
        genre: 1,
        genreConfidence: 1,
        genreSource: 1,
      }
    )
      .sort({ date: 1 })
      .lean();

    const externalHighlighted = await ExternalEvents.find(
      {
        highlighted: true,
        date: { $gte: todayStart },
      }
    )
      .sort({ date: 1 })
      .lean();

    const mergedExternal = externalHighlighted.map((ev) => ({
      _id: ev._id,
      title: ev.title,
      link: ev.link,
      imageUrl: ev.imageUrl,
      date: ev.date,
      venue: ev.venue,
      eventInfo: ev.eventInfo,
      eventPrice: ev.eventPrice,
      ticketLink: ev.ticketLink,
      genre: ev.genre,
      genreSource: ev.genre ? "admin" : null,
      _isExternal: true,
    }));

    const merged = [...concerts, ...mergedExternal].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte hämta highlighted events.", error: error.message });
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

// Whitelist över fält en organizer får ändra på sina egna external events
// via PATCH. Allt annat (t.ex. venue eller _id) är låst.
// Whitelist över fält en organizer får ändra på sina egna external events
// via PATCH. highlighted är AVSIKTLIGT inte med - den ska bara super-admin
// kunna sätta (via /admin-rutter, inte här).
const EXTERNAL_EDITABLE_FIELDS = [
  "title",
  "date",
  "link",
  "eventInfo",
  "eventPrice",
  "ticketLink",
  "genre",
];

/**
 * Returnerar ett normaliserat genre-värde eller kastar Error om värdet
 * inte är tillåtet. Tomt/null betyder "ingen genre satt" - inte ett fel.
 */
function validateGenre(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !GENRES.includes(value)) {
    const err = new Error(
      `Ogiltig genre '${value}'. Tillåtna värden: ${GENRES.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }
  return value;
}

/**
 * Säkerställer att en URL har ett protokoll. Användare skriver ofta
 * `www.hej.se` utan https:// - utan protokoll tolkar browsern det som en
 * relativ path och rendrerar `livegbg.com/admin/www.hej.se`.
 */
function normalizeLink(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // mailto:/tel: och liknande - lämna orörda
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

router.post(
  "/external",
  authenticateToken,
  requireRole("organizer"),
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        date,
        link,
        songs,
        eventInfo,
        eventPrice,
        ticketLink,
        genre,
      } = req.body;
      if (!req.user || !req.user.venue) {
        return res
          .status(400)
          .json({ message: "Din användare saknar en venue. Kontakta admin." });
      }

      let normalizedGenre;
      try {
        normalizedGenre = validateGenre(genre);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }

      let imageUrl = "";
      if (req.file) {
        console.log("Filen mottagen:", req.file);
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "events",
        });
        console.log("Cloudinary-resultat:", result);
        imageUrl = result.secure_url;
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Fel vid borttagning av lokala filen:", err);
        });
      }

      const eventData = {
        title,
        date,
        imageUrl,
        songs,
        venue: req.user.venue,
        genre: normalizedGenre,
        // highlighted defaultar till false i schemat - sätts manuellt av
        // super-admin via /admin-rutten, inte vid skapande.
      };

      if (link && link.trim() !== "") {
        eventData.link = normalizeLink(link);
      } else {
        eventData.eventInfo = eventInfo;
        eventData.eventPrice = eventPrice;
        eventData.ticketLink = normalizeLink(ticketLink);
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

/**
 * PATCH /api/events/external/:id
 * Uppdatera ett av sina egna external events. Whitelist över tillåtna fält.
 * Bild kan uppdateras genom att skicka ny `image`-fil.
 */
router.patch(
  "/external/:id",
  authenticateToken,
  requireRole("organizer"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.user || !req.user.venue) {
        return res
          .status(400)
          .json({ message: "Din användare saknar en venue. Kontakta admin." });
      }

      const event = await ExternalEvents.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Eventet hittades inte." });
      }

      // Organizer får bara röra events kopplade till sin egen venue
      if (event.venue !== req.user.venue) {
        return res.status(403).json({
          message: "Du har inte behörighet att redigera detta event.",
        });
      }

      const updates = {};
      for (const field of EXTERNAL_EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      }

      // Validera genre mot enum:n (samma lista som Concert använder).
      // genre: null/empty är ett giltigt värde ("ingen genre satt") - inte
      // ett fel - så vi sparar det som null snarare än att unset:a.
      if (Object.prototype.hasOwnProperty.call(updates, "genre")) {
        try {
          updates.genre = validateGenre(updates.genre);
        } catch (err) {
          return res.status(400).json({ message: err.message });
        }
      }


      // Ny bild laddas upp till Cloudinary och ersätter den gamla URL:en
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "events",
        });
        updates.imageUrl = result.secure_url;
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Fel vid borttagning av lokala filen:", err);
        });
      }

      // Normalisera URL-fält så de inte tolkas som relativa paths av browsern
      if (Object.prototype.hasOwnProperty.call(updates, "ticketLink")) {
        updates.ticketLink = normalizeLink(updates.ticketLink);
      }

      // Om link sätts ska info-fälten tömmas (och vice versa), så vi inte
      // hamnar i ett inkonsekvent tillstånd.
      if (Object.prototype.hasOwnProperty.call(updates, "link")) {
        if (updates.link && updates.link.trim() !== "") {
          updates.link = normalizeLink(updates.link);
          updates.eventInfo = "";
          updates.eventPrice = "";
          updates.ticketLink = "";
        }
        // else: link skickades som tom string - lämna kvar för nästa loop
        // som omvandlar det till $unset
      }

      // Bygg om updates till $set/$unset så vi kan TA BORT fält när
      // användaren skickar tom string. $set: { link: undefined } är en
      // no-op i Mongoose - vi måste explicit $unset för att rensa.
      // Genre hanteras separat eftersom null är ett giltigt sparat värde.
      const $set = {};
      const $unset = {};
      for (const [k, v] of Object.entries(updates)) {
        if (k === "genre") {
          $set.genre = v;
          continue;
        }
        if (v === undefined || v === null || v === "") {
          $unset[k] = "";
        } else {
          $set[k] = v;
        }
      }
      const updateOp = {};
      if (Object.keys($set).length) updateOp.$set = $set;
      if (Object.keys($unset).length) updateOp.$unset = $unset;

      const updated = await ExternalEvents.findByIdAndUpdate(
        req.params.id,
        updateOp,
        { new: true, runValidators: true }
      );

      res.json(updated);
    } catch (error) {
      console.error("Error vid uppdatering av event:", error);
      res.status(500).json({
        message: "Kunde inte uppdatera eventet.",
        error: error.message,
      });
    }
  }
);

router.delete(
  "/external/:id",
  authenticateToken,
  requireRole("organizer"),
  async (req, res) => {
    try {
      if (!req.user || !req.user.venue) {
        return res
          .status(400)
          .json({ message: "Din användare saknar en venue. Kontakta admin." });
      }

      const event = await ExternalEvents.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Eventet hittades inte." });
      }

      if (event.venue !== req.user.venue) {
        return res.status(403).json({
          message: "Du har inte behörighet att ta bort detta event.",
        });
      }

      // .remove() är borttaget i Mongoose 7+ — använd deleteOne på dokumentet
      await event.deleteOne();
      res.status(200).json({ message: "Eventet har raderats." });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Kunde inte radera eventet.", error: error.message });
    }
  }
);

router.get(
  "/external/my-events",
  authenticateToken,
  requireRole("organizer"),
  async (req, res) => {
    try {
      if (!req.user || !req.user.venue) {
        return res
          .status(400)
          .json({ message: "Din användare saknar en venue. Kontakta admin." });
      }

      const events = await ExternalEvents.find({
        venue: req.user.venue,
      }).sort({ _id: -1 });
      res.json(events);
    } catch (error) {
      res.status(500).json({
        message: "Kunde inte hämta dina events.",
        error: error.message,
      });
    }
  }
);

module.exports = router;
