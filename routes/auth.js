const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Anta att användarmodellen är i models/user.js
const router = express.Router();

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Kontrollera om användaren finns
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }

    console.log("USER", user);

    console.log("PASSWORD", password);
    // Kontrollera lösenordet
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("PASSWORD doesnt match");
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }

    // Skapa JWT-token
    const token = jwt.sign(
      { userId: user._id, place: user.place },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Skicka token till klienten
    res.json({ token, message: "Inloggning lyckades!" });
  } catch (error) {
    res.status(500).json({ message: "Något gick fel.", error });
  }
});

module.exports = router;
