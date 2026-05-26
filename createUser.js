const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const User = require("./models/user");
dotenv.config();

// CLI-script för att skapa privilegierade användare (organizer / super-admin).
// Vanliga slutanvändare ska INTE skapas via det här scriptet - de registrerar
// sig själva via /auth/register eller OAuth.
// Anv:
//   ROLES=super-admin EMAIL=du@example.se PASSWORD=hemligt node createUser.js
//   ROLES=organizer EMAIL=foo@bar.se PASSWORD=hemligt VENUE=Pustervik node createUser.js
async function createUser({ email, password, venue, roles }) {
  console.log(process.env.DB_CONNECT);
  try {
    await mongoose.connect(process.env.DB_CONNECT, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Användare med den e-posten finns redan.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      venue,
      roles,
      providers: [{ provider: "password", providerId: email }],
    });

    await newUser.save();
    console.log("Användare skapad:", {
      email: newUser.email,
      venue: newUser.venue,
      roles: newUser.roles,
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error("Kunde inte skapa användare:", error);
  }
}

const email = process.env.EMAIL || "scen@konstepidemin.se";
const password = process.env.PASSWORD || "Konst-21A";
const venue = process.env.VENUE || "Konstepidemin";
const roles = (process.env.ROLES || "organizer")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

createUser({ email, password, venue, roles });
