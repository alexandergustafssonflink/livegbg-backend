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
  next();
});

module.exports = mongoose.model(
  "ExternalEvent",
  externalEventSchema,
  "external-events"
);
