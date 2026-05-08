const mongoose = require("mongoose");

// En provider-koppling: t.ex. { provider: "google", providerId: "1234..." }
// En user kan ha flera (samma email kan ha både password och google-providern).
const providerSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "password"], required: true },
    providerId: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  // Lösenord är nu optional - users som loggar in via OAuth har inget.
  password: {
    type: String,
    required: false,
  },
  // Visningsnamn (kommer från OAuth eller användaren själv)
  name: {
    type: String,
    trim: true,
  },
  avatarUrl: {
    type: String,
  },
  // Vilka identitets-providers som denna user kan logga in via
  providers: {
    type: [providerSchema],
    default: [],
  },
  // Venue/plats för organizers. Tom för vanliga användare.
  place: {
    type: String,
    required: false,
  },
  // Roller: "user" (default), "organizer", "super-admin"
  roles: {
    type: [String],
    default: ["user"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Snabb lookup på provider+providerId vid OAuth-callback
userSchema.index({ "providers.provider": 1, "providers.providerId": 1 });

module.exports = mongoose.model("User", userSchema, "users");
