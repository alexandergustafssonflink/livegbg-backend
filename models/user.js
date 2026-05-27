const mongoose = require("mongoose");
const dualVenueField = require("../utils/dualVenueField");

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
  // Venue för organizers. Tom för vanliga användare och super-admins.
  // Normaliseras till trimmad lowercase så ExternalEvent.venue-matchningen
  // är robust mot olika skiftläge ("Pustervik" vs "pustervik").
  venue: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
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

// Bakåtkompatibel läsning under övergångsperioden från place→venue.
// Tas bort när jobs/renamePlaceToVenue.js har körts mot prod och inga
// dokument längre har `place`-fältet.
userSchema.plugin(dualVenueField);

module.exports = mongoose.model("User", userSchema, "users");
