const mongoose = require("mongoose");

const concertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
  },
  link: {
    type: String,
    required: false,
  },
  imageUrl: {
    type: String,
    required: false,
  },
  date: {
    type: String,
    required: false,
  },
  place: {
    type: String,
    required: false,
  },
  tickets: {
    type: String,
    required: false,
  },
  insertDate: {
    type: Date,
  },
  city: {
    type: String,
  },
});

module.exports = mongoose.model("Concert", concertSchema);
