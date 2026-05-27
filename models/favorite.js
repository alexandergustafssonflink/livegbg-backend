const mongoose = require("mongoose");

// De typer en favorit kan peka mot. Mongoose använder eventType-värdet
// som modellnamn vid populate() via refPath, så de måste matcha exakt
// vad som skickas till mongoose.model() i resp. modulfiler.
const EVENT_TYPES = ["Concert", "ExternalEvent"];

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Polymorf referens. eventType styr vilken collection eventId pekar
    // mot (Concert eller ExternalEvent). populate({ path: "eventId" })
    // resolverar dynamiskt rätt modell.
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "eventType",
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      default: "Concert",
      required: true,
    },
  },
  { timestamps: true }
);

// En user kan inte favoritmarkera samma event två gånger. Inkluderar
// eventType i nyckeln för att vara säker även om Concert och ExternalEvent
// skulle dela ObjectId (i praktiken extremt osannolikt men inte garanterat).
favoriteSchema.index(
  { userId: 1, eventId: 1, eventType: 1 },
  { unique: true }
);
favoriteSchema.index({ userId: 1, createdAt: -1 });
favoriteSchema.index({ eventId: 1 });

module.exports = mongoose.model("Favorite", favoriteSchema, "favorites");
