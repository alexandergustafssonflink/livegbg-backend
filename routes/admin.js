const router = require("express").Router();
const Concert = require("../models/concert");
const User = require("../models/user");
const authenticateToken = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const GENRES = require("../utils/genres");

const ALLOWED_ROLES = ["user", "organizer", "super-admin"];

// Alla endpoints i den här filen kräver super-admin
router.use(authenticateToken, requireRole("super-admin"));

/**
 * GET /api/admin/genres
 * Returnerar listan över giltiga genrer (för dropdown i frontend).
 */
router.get("/genres", (req, res) => {
  res.json(GENRES);
});

/**
 * GET /api/admin/concerts
 * Lista konserter för admin-vyn. Stöd för filter via query-string:
 *   ?city=Göteborg
 *   ?search=Linkin              (matchning mot title/venue, case-insensitive)
 *   ?includeInactive=true       (default: false)
 *   ?includePast=true           (default: false - bara framtida events)
 *   ?limit=200&skip=0           (paginering)
 */
router.get("/concerts", async (req, res) => {
  try {
    const {
      city,
      search,
      includeInactive,
      includePast,
      limit = 200,
      skip = 0,
    } = req.query;

    const query = {};
    if (city) query.city = city;
    if (includeInactive !== "true") query.isActive = true;

    if (includePast !== "true") {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      query.date = { $gte: todayStart };
    }

    if (search) {
      // Escape:a regex-tecken så användaren kan söka fritt
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { venue: { $regex: escaped, $options: "i" } },
      ];
    }

    const concerts = await Concert.find(query)
      .sort({ date: 1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 500))
      .lean();

    res.json(concerts);
  } catch (error) {
    console.error("Admin GET /concerts error:", error);
    res.status(500).json({ message: "Kunde inte hämta konserter.", error: error.message });
  }
});

/**
 * PATCH /api/admin/concerts/:id
 * Uppdatera fält på en konsert. Endast vissa fält tillåts (whitelist).
 * Body: { genre?, highlighted?, isActive?, title?, venue?, date?, link?, imageUrl?, tickets? }
 */
router.patch("/concerts/:id", async (req, res) => {
  try {
    const allowedFields = [
      "genre",
      "highlighted",
      "isActive",
      "title",
      "venue",
      "date",
      "link",
      "imageUrl",
      "tickets",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    // Validera genre mot listan (null/undefined betyder "ingen genre satt")
    if (
      updates.genre !== undefined &&
      updates.genre !== null &&
      updates.genre !== "" &&
      !GENRES.includes(updates.genre)
    ) {
      return res.status(400).json({
        message: `Ogiltig genre '${updates.genre}'. Tillåtna värden: ${GENRES.join(", ")}`,
      });
    }
    if (updates.genre === "") updates.genre = null;

    // När admin sätter en genre manuellt, märk källan som 'admin' så
    // AI-backfillen aldrig override:ar den. Om admin nollställer genre
    // (väljer tomt i dropdown), nollas också source så event:et blir
    // berättigat för AI-klassning igen.
    if (Object.prototype.hasOwnProperty.call(updates, "genre")) {
      if (updates.genre) {
        updates.genreSource = "admin";
      } else {
        updates.genreSource = null;
        updates.genreConfidence = null;
        updates.aiAnalyzedAt = null;
        updates.genrePromptVersion = null;
      }
    }

    const concert = await Concert.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!concert) {
      return res.status(404).json({ message: "Konserten hittades inte." });
    }

    res.json(concert);
  } catch (error) {
    console.error("Admin PATCH /concerts error:", error);
    res.status(500).json({ message: "Kunde inte uppdatera konserten.", error: error.message });
  }
});

/**
 * GET /api/admin/users
 * Lista alla användare (paginerat). Stöd för sökning på email/name och
 * filter på roll.
 *   ?search=...
 *   ?role=organizer            (filtera på en specifik roll)
 *   ?limit=50&skip=0
 */
router.get("/users", async (req, res) => {
  try {
    const { search, role, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (role) query.roles = role;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { email: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
      ];
    }

    const users = await User.find(query, { password: 0 })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .lean();

    res.json(users);
  } catch (error) {
    console.error("Admin GET /users error:", error);
    res.status(500).json({ message: "Kunde inte hämta användare.", error: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Uppdatera en användares roller och/eller venue.
 * Body: { roles?: ["organizer"|"super-admin"|"user"], venue?: string|null }
 *
 * Regler:
 *   - Vi tillåter inte att den inloggade super-adminen demoterar sig själv.
 *   - Om slut-tillståndet inkluderar rollen "organizer" måste venue vara satt
 *     (annars går det inte att binda events till någon lokal).
 *   - venue normaliseras alltid till trim+lowercase för robust matchning
 *     mot ExternalEvent.venue.
 */
router.patch("/users/:id", async (req, res) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Användaren hittades inte." });
    }

    const updates = {};

    if (Array.isArray(req.body.roles)) {
      const invalid = req.body.roles.filter((r) => !ALLOWED_ROLES.includes(r));
      if (invalid.length) {
        return res
          .status(400)
          .json({ message: `Ogiltiga roller: ${invalid.join(", ")}. Tillåtna: ${ALLOWED_ROLES.join(", ")}` });
      }
      // Skydda mot tom roll-array - alla user måste ha minst "user"
      const cleaned = req.body.roles.length > 0 ? req.body.roles : ["user"];
      updates.roles = [...new Set(cleaned)]; // dedupe
    }

    let venueProvided = false;
    if (Object.prototype.hasOwnProperty.call(req.body, "venue")) {
      venueProvided = true;
      const raw = req.body.venue;
      // Normalisera redan här eftersom Mongoose-setters (lowercase/trim) inte
      // garanterat körs på findByIdAndUpdate i alla versioner.
      const normalized =
        typeof raw === "string" && raw.trim()
          ? raw.trim().toLowerCase()
          : undefined;
      updates.venue = normalized;
    }

    // Förhindra att en super-admin demoterar sig själv av misstag
    if (
      String(req.params.id) === String(req.user._id) &&
      updates.roles &&
      !updates.roles.includes("super-admin")
    ) {
      return res.status(400).json({
        message: "Du kan inte ta bort din egen super-admin-roll.",
      });
    }

    // Validera slut-tillståndet: organizer-rollen kräver en venue
    const finalRoles = updates.roles ?? existing.roles ?? [];
    const finalVenue = venueProvided ? updates.venue : existing.venue;
    if (finalRoles.includes("organizer") && !finalVenue) {
      return res.status(400).json({
        message: "Organizer-rollen kräver en venue.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true, projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: "Användaren hittades inte." });
    }

    res.json(user);
  } catch (error) {
    console.error("Admin PATCH /users error:", error);
    res.status(500).json({ message: "Kunde inte uppdatera användaren.", error: error.message });
  }
});

module.exports = router;
