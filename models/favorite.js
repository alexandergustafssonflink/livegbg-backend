const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    concertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Concert",
      required: true,
    },
  },
  { timestamps: true }
);

// En user kan inte favoritmarkera samma konsert två gånger
favoriteSchema.index({ userId: 1, concertId: 1 }, { unique: true });

// Snabb query: alla favoriter för en user, sorterat på senaste
favoriteSchema.index({ userId: 1, createdAt: -1 });

// Snabb query: hur många favoriter ett event har (om vi vill visa popularitet)
favoriteSchema.index({ concertId: 1 });

module.exports = mongoose.model("Favorite", favoriteSchema, "favorites");
