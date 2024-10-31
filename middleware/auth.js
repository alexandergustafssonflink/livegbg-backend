// middleware/authenticate.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function authenticateToken(req, res, next) {
  console.log("AUTHENTICATING TOKEN");
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Ingen token tillhandahållen." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED", decoded);
    req.user = await User.findById(decoded.userId); // Lägg till användaren i req
    console.log("USER", req.user);
    next();
  } catch (error) {
    res.status(403).json({ message: "Ogiltig token." });
  }
}

module.exports = authenticateToken;
