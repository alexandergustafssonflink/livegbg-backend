const mongoose = require("mongoose");

/**
 * Enkel key/value-store för driftinställningar som behöver överleva
 * omstarter och kunna uppdateras i runtime (t.ex. Instagram-token som
 * refreshas var 60:e dag — den kan inte ligga enbart i env eftersom
 * refreshen genererar ett nytt värde).
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema, "settings");
