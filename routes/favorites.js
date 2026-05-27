const router = require("express").Router();
const Favorite = require("../models/favorite");
const Concert = require("../models/concert");
const ExternalEvent = require("../models/external-event");
const authenticateToken = require("../middleware/auth");

// Alla favorites-routes kräver inloggad user
router.use(authenticateToken);

// Mappning från eventType till respektive Mongoose-modell. Används för
// att slå upp att eventet faktiskt existerar innan vi sparar favoriten.
const MODELS_BY_TYPE = {
  Concert,
  ExternalEvent,
};

const ALLOWED_EVENT_TYPES = Object.keys(MODELS_BY_TYPE);

/**
 * Läser och validerar eventType från body/query. Default Concert så
 * äldre frontend-kod (innan polymorfi infördes) fortsätter fungera.
 */
function resolveEventType(req) {
  const raw = req.body?.eventType || req.query?.eventType || "Concert";
  if (!ALLOWED_EVENT_TYPES.includes(raw)) {
    const err = new Error(
      `Ogiltig eventType '${raw}'. Tillåtna: ${ALLOWED_EVENT_TYPES.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }
  return raw;
}

/**
 * GET /api/favorites
 * Returnerar alla favoriter för inloggad user, populerat med tillhörande
 * event (Concert eller ExternalEvent), sorterat på event-datum.
 */
router.get("/", async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .populate({ path: "eventId" })
      .lean();

    // populate via refPath kan returnera null om refererat doc raderats -
    // filtrera bort dem så frontend inte krashar.
    const enriched = favorites
      .filter((f) => f.eventId)
      .map((f) => ({
        favoriteId: f._id,
        favoritedAt: f.createdAt,
        eventType: f.eventType,
        event: {
          ...f.eventId,
          _isExternal: f.eventType === "ExternalEvent",
        },
      }))
      .sort((a, b) => new Date(a.event.date) - new Date(b.event.date));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({
      message: "Kunde inte hämta favoriter.",
      error: error.message,
    });
  }
});

/**
 * GET /api/favorites/ids
 * Returnerar bara eventId-erna - lättviktig endpoint för att synka
 * hjärt-ikonens state över alla event-cards i listan. Eftersom MongoDB
 * ObjectId i praktiken är unika över collections räcker det med ID:t -
 * vi behöver inte returnera typ också.
 */
router.get("/ids", async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .select("eventId -_id")
      .lean();
    res.json(favorites.map((f) => String(f.eventId)));
  } catch (error) {
    res.status(500).json({
      message: "Kunde inte hämta favorit-ids.",
      error: error.message,
    });
  }
});

/**
 * POST /api/favorites/:eventId
 * Body: { eventType?: "Concert" | "ExternalEvent" }
 * Markera ett event som favorit. Idempotent.
 */
router.post("/:eventId", async (req, res) => {
  try {
    const eventType = resolveEventType(req);
    const Model = MODELS_BY_TYPE[eventType];

    const event = await Model.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: `${eventType} finns inte.` });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { userId: req.user._id, eventId: event._id, eventType },
      {
        $setOnInsert: {
          userId: req.user._id,
          eventId: event._id,
          eventType,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json(favorite);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    res
      .status(500)
      .json({ message: "Kunde inte spara favorit.", error: error.message });
  }
});

/**
 * DELETE /api/favorites/:eventId
 * Body: { eventType?: "Concert" | "ExternalEvent" }
 * Ta bort favorit. Idempotent.
 */
router.delete("/:eventId", async (req, res) => {
  try {
    const eventType = resolveEventType(req);
    await Favorite.deleteOne({
      userId: req.user._id,
      eventId: req.params.eventId,
      eventType,
    });
    res.json({ message: "Favorit borttagen." });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    res
      .status(500)
      .json({ message: "Kunde inte ta bort favorit.", error: error.message });
  }
});

module.exports = router;
