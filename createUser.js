const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const User = require("./models/user"); // Anpassa sökvägen till din User-modell
dotenv.config();

async function createUser(email, password, place) {
  dotenv.config();
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
      place,
      roles: ["user"],
    });

    await newUser.save();
    console.log("Användare skapad:", newUser);

    await mongoose.disconnect();
  } catch (error) {
    console.error("Kunde inte skapa användare:", error);
  }
}

createUser("scen@konstepidemin.se", "Konst-21A", "Konstepidemin");
