const mongoose = require("mongoose");
const dualVenueField = require("../utils/dualVenueField");
const GENRES = require("../utils/genres");
const { generateEventSlug } = require("../utils/eventSlug");

const externalEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  // URL-slug för /event/:slug — samma system som Concert.slug (se
  // utils/eventSlug.js). Sätts i pre-save, ändras aldrig därefter.
  slug: {
    type: String,
    index: true,
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
  // Highlighted events dyker upp i den publika karusellen längst upp på
  // hem-sidan. Sätts manuellt av organizer (för egna events) eller super-
  // admin (för konserter via AdminConcerts).
  highlighted: {
    type: Boolean,
    default: false,
  },
  songs: {
    type: Array,
  },
});

externalEventSchema.pre("validate", function (next) {
  // Antingen länk till externt event ELLER eventInfo (beskrivning) krävs.
  // Pris och ticketLink är valfria - en organizer kan ha events utan
  // biljettförsäljning eller med varierande/ej annonserat pris.
  if (!this.link && !this.eventInfo) {
    return next(
      new Error(
        "Antingen 'link' eller 'eventInfo' (beskrivning) måste fyllas i."
      )
    );
  }
  // Säkerställ att venue är satt - antingen direkt eller via legacy place
  if (!this.venue && !this.place) {
    return next(new Error("Venue är obligatoriskt."));
  }
  next();
});

// Bakåtkompatibel läsning under övergångsperioden från place→venue.
externalEventSchema.plugin(dualVenueField);

// Auto-generera slug för nya dokument. Befintlig slug rörs aldrig.
externalEventSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = generateEventSlug(this);
  }
  next();
});

module.exports = mongoose.model(
  "ExternalEvent",
  externalEventSchema,
  "external-events"
);
