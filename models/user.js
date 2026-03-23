const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  place: {
    type: String,
    required: false,
  },
  roles: {
    type: [String],
    default: ["user"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook för att hash:a lösenordet
// userSchema.pre("save", async function (next) {
//   if (this.isModified("password")) {
//     const bcrypt = require("bcrypt");
//     this.password = await bcrypt.hash(this.password, 10);
//   }
//   next();
// });

module.exports = mongoose.model("User", userSchema, "users");
