const mongoose = require("mongoose");
const GENRES = require("../utils/genres");

const concertSchema = new mongoose.Schema(
  {
    title: { type: String },
    link: { type: String },
    imageUrl: { type: String },
    date: { type: Date },
    place: { type: String },
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
    // ska klassa genre / generera sammanfattning.
    //
    // pageContentFetchedAt sätts vid lyckad hämtning, FailedAt vid miss
    // — backfillen retryar inte misslyckade på en vecka.
    pageContent: { type: String },
    pageContentFetchedAt: { type: Date },
    pageContentFetchFailedAt: { type: Date },
  },
  { timestamps: true }
);

// Snabb upsert-matchning via link inom en venue (primär matchningsnyckel)
concertSchema.index({ place: 1, link: 1 });
// Fallback-matchning via venue + datum
concertSchema.index({ place: 1, date: 1 });
// Frontend-läsningar
concertSchema.index({ city: 1, isActive: 1, date: 1 });
// Karusell-feed: highlighted + framtida events
concertSchema.index({ city: 1, highlighted: 1, isActive: 1, date: 1 });
// Backfill-queue: hitta events som saknar description (DEPRECATED, se ovan)
concertSchema.index({ description: 1, isActive: 1, date: 1 });
// Backfill-queue för pageContent
concertSchema.index({ pageContent: 1, isActive: 1, date: 1 });

module.exports = mongoose.model("Concert", concertSchema, "concerts");
