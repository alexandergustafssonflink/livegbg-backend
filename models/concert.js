const mongoose = require("mongoose");

const concertSchema = new mongoose.Schema(
  {
    title: { type: String },
    link: { type: String },
    imageUrl: { type: String },
    date: { type: Date },
    place: { type: String },
    tickets: { type: String },
    city: { type: String },

    // Tracking-fält som låter scrapern uppdatera istället för att skapa nytt
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date() },
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date },
  },
  { timestamps: true }
);

// Snabb upsert-matchning via link inom en venue (primär matchningsnyckel)
concertSchema.index({ place: 1, link: 1 });
// Fallback-matchning via venue + datum
concertSchema.index({ place: 1, date: 1 });
// Frontend-läsningar
concertSchema.index({ city: 1, isActive: 1, date: 1 });

module.exports = mongoose.model("Concert", concertSchema, "concerts");
