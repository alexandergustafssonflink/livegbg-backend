const mongoose = require("mongoose");

const eventsSchema = new mongoose.Schema({
    events: {
        type: Array
    },
    date: {
        type: Date
    }
})

module.exports = mongoose.model("Events", eventsSchema, "events")