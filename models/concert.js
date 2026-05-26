const mongoose = require("mongoose");
const GENRES = require("../utils/genres");
const dualVenueField = require("../utils/dualVenueField");

const concertSchema = new mongoose.Schema(
  {
    title: { type: String },
    link: { type: String },
    imageUrl: { type: String },
    date: { type: Date },
    venue: { type: String },
    tickets: { type: String },
    city: { type: String },

    // Manuellt redigerbara fält (super-admin)
    genre: { type: String, enum: [...GENRES, null], default: null },
    highlighted: { type: Boolean, default: false },

    // Tracking-fält som låter scrapern uppdatera istället för att skapa nytt
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date() },
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date },

    // Råtext från event-sidan, hämtas av en GENERISK extractor (inga
    // per-venue-selektorer). Fungerar som input till LLM-pipelinen som
    // klassar genre / genererar sammanfattning.
    //
    // pageContentFetchedAt sätts vid lyckad hämtning, FailedAt vid miss
    // — backfillen retryar inte misslyckade på en vecka.
    pageContent: { type: String },
    pageContentFetchedAt: { type: Date },
    pageContentFetchFailedAt: { type: Date },

    // Genre-klassning från Claude Haiku.
    //   genreSource: 'ai' = automatisk klassning, 'admin' = manuellt satt
    //     (admin-tagging override:as aldrig av AI:n).
    //   genreConfidence: 0-1, AI:s egen säkerhet. Frontend visar bara genre
    //     till inloggade användare och bara om confidence >= 0.7.
    //   genrePromptVersion: tracks vilken prompt-version som producerade
    //     tagningen — låter oss re-klassa allt när vi tweakar prompten.
    genreConfidence: { type: Number, min: 0, max: 1 },
    genreSource: { type: String, enum: ["ai", "admin", null], default: null },
    genrePromptVersion: { type: String },
    aiAnalyzedAt: { type: Date },

    // Markering för klassificeringfel eller non-livemusic events.
    //   isNotLiveMusic: true = LLM bedömde detta som inte livemusik
    //     (t.ex. teater, komik, DJ-set utan genre-info). Event deaktiveras
    //     och ska inte scrapas igen.
    //   genreClassificationFailedAt: sätts när LLM-klassning misslyckades.
    //     Backfill-jobbet retryar inte inom en vecka för att undvika
    //     upprepad API-användning på events som är svåra att klassificera.
    isNotLiveMusic: { type: Boolean, default: false },
    genreClassificationFailedAt: { type: Date },
  },
  { timestamps: true }
);

// Snabb upsert-matchning via link inom en venue (primär matchningsnyckel)
concertSchema.index({ venue: 1, link: 1 });
// Fallback-matchning via venue + datum
concertSchema.index({ venue: 1, date: 1 });
// Frontend-läsningar
concertSchema.index({ city: 1, isActive: 1, date: 1 });
// Karusell-feed: highlighted + framtida events
concertSchema.index({ city: 1, highlighted: 1, isActive: 1, date: 1 });
// Backfill-queue för pageContent
concertSchema.index({ pageContent: 1, isActive: 1, date: 1 });
// Backfill-queue för genre-klassning (events med pageContent men ingen genre)
concertSchema.index({ pageContent: 1, genre: 1, isActive: 1 });
// Backfill-queue för genre-klassning (exkludera recent failures)
concertSchema.index({ genreClassificationFailedAt: 1, isActive: 1 });
// Track non-livemusic events
concertSchema.index({ isNotLiveMusic: 1, isActive: 1 });

// Bakåtkompatibel läsning under övergångsperioden från place→venue.
// OBS: Concert.venue lowercaseas INTE av pluginen för Concert-dokument
// eftersom det är scrapad display-data ("Pustervik", inte "pustervik").
// Eftersom Concert-schemat inte har lowercase: true på venue-fältet
// behåller pluginen sin case-insensitive matchning för bakåtkomp men
// rör inte stored values.
concertSchema.plugin(dualVenueField);

module.exports = mongoose.model("Concert", concertSchema, "concerts");
