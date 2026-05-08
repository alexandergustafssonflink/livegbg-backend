const router = require("express").Router();
const Favorite = require("../models/favorite");
const Concert = require("../models/concert");
const authenticateToken = require("../middleware/auth");

// Alla favorites-routes kräver inloggad user
router.use(authenticateToken);

/**
 * GET /api/favorites
 * Returnerar alla favoriter för inloggad user, joinat med Concert-data,
 * sorterat på konsertdatum (kommande först).
 */
router.get("/", async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .populate({
        path: "concertId",
        select:
          "title link imageUrl date place city tickets genre highlighted isActive",
      })
      .lean();

    // Filtrera bort ev. dangling refs (concert raderad/borttagen)
    const enriched = favorites
      .filter((f) => f.concertId)
      .map((f) => ({
        favoriteId: f._id,
        favoritedAt: f.createdAt,
        concert: f.concertId,
      }))
      .sort((a, b) => new Date(a.concert.date) - new Date(b.concert.date));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte hämta favoriter.", error: error.message });
  }
});

/**
 * GET /api/favorites/ids
 * Returnerar bara concertId-erna - lättviktig endpoint för att synka
 * hjärt-ikonens state över alla event-cards i listan.
 */
router.get("/ids", async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .select("concertId -_id")
      .lean();
    res.json(favorites.map((f) => String(f.concertId)));
  } catch (error) {
    res.status(500).json({ message: "Kunde inte hämta favorit-ids.", error: error.message });
  }
});

/**
 * POST /api/favorites/:concertId
 * Markera en konsert som favorit. Idempotent - returnerar samma response
 * även om favoriten redan finns.
 */
router.post("/:concertId", async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) {
      return res.status(404).json({ message: "Konserten finns inte." });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { userId: req.user._id, concertId: concert._id },
      { $setOnInsert: { userId: req.user._id, concertId: concert._id } },
      { upsert: true, new: true }
    );

    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte spara favorit.", error: error.message });
  }
});

/**
 * DELETE /api/favorites/:concertId
 * Ta bort favorit. Idempotent - 200 även om den inte fanns.
 */
router.delete("/:concertId", async (req, res) => {
  try {
    await Favorite.deleteOne({
      userId: req.user._id,
      concertId: req.params.concertId,
    });
    res.json({ message: "Favorit borttagen." });
  } catch (error) {
    res.status(500).json({ message: "Kunde inte ta bort favorit.", error: error.message });
  }
});

module.exports = router;
