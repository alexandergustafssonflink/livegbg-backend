const mongoose = require("mongoose");

const externalEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  place: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    required: true,
  },
  songs: {
    type: Array,
  },
});

module.exports = mongoose.model(
  "External events",
  externalEventSchema,
  "external-events"
);
