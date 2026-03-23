const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(req);

  try {
    const user = await User.findOne({ email });
    console.log("USER", user);
    if (!user) {
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }

    console.log("USER", user);

    console.log("PASSWORD", password);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("PASSWORD doesnt match");
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }

    const token = jwt.sign(
      { userId: user._id, place: user.place },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, message: "Inloggning lyckades!" });
  } catch (error) {
    res.status(500).json({ message: "Något gick fel.", error });
  }
});

module.exports = router;
