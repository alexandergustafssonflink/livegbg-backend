const mongoose = require("mongoose");

const artistSchema = new mongoose.Schema({
    name: {
        type: String
    },
    info: {
        type: Object
    },
    date: {
        type: Date
    }
})

module.exports = mongoose.model("Artist", artistSchema, "artist")