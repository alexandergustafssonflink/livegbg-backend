const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const User = require("./models/user"); // Anpassa sökvägen till din User-modell
dotenv.config();

async function createUser(email, password, place) {
  dotenv.config();
  console.log(process.env.DB_CONNECT);
  try {
    // Anslut till MongoDB
    await mongoose.connect(process.env.DB_CONNECT, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Kontrollera om användaren redan finns
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Användare med den e-posten finns redan.");
      return;
    }

    // Hasha lösenordet
    const hashedPassword = await bcrypt.hash(password, 10);

    // Skapa användaren
    const newUser = new User({
      email,
      password: hashedPassword,
      place,
      roles: ["user"], // valfritt, lägg till roller om det behövs
    });

    // Spara användaren i databasen
    await newUser.save();
    console.log("Användare skapad:", newUser);

    // Koppla från databasen
    await mongoose.disconnect();
  } catch (error) {
    console.error("Kunde inte skapa användare:", error);
  }
}

// Anropa funktionen med din e-post, lösenord och plats
createUser("alex1@test.com", "hejhej", "Jazzhuset");
