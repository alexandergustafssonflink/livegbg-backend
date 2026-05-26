const mongoose = require("mongoose");
const dualVenueField = require("../utils/dualVenueField");
const GENRES = require("../utils/genres");

const externalEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  // Venue normaliseras till trim+lowercase så queries mot User.venue matchar
  // även om någon skrivit olika skiftläge på olika ställen. Inte required
  // under övergångsperioden eftersom legacy-dokument kan ha värdet i det
  // gamla `place`-fältet istället - dualVenueField-pluginen läker över tid.
  venue: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  eventInfo: {
    type: String,
  },
  eventPrice: {
    type: String,
  },
  ticketLink: {
    type: String,
  },
  // Genre använder samma enum som Concert så filtrering i HomePage:n och
  // genre-visning fungerar identiskt för båda källorna. Sätts manuellt av
  // organizer vid skapande/redigering - ingen AI-klassning för external.
  genre: {
    type: String,
    enum: [...GENRES, null],
    default: null,
  },
  songs: {
    type: Array,
  },
});

externalEventSchema.pre("validate", function (next) {
  if (!this.link) {
    if (!this.eventInfo || !this.eventPrice) {
      return next(
        new Error(
          "Antingen måste 'link' skickas med, eller så måste 'eventInfo', 'eventPrice' och 'ticketLink' fyllas i."
        )
      );
    }
  }
  // Säkerställ att venue är satt - antingen direkt eller via legacy place
  if (!this.venue && !this.place) {
    return next(new Error("Venue är obligatoriskt."));
  }
  next();
});

// Bakåtkompatibel läsning under övergångsperioden från place→venue.
externalEventSchema.plugin(dualVenueField);

module.exports = mongoose.model(
  "ExternalEvent",
  externalEventSchema,
  "external-events"
);
