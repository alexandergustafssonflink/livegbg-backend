const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/user");
const authenticateToken = require("../middleware/auth");
const { findOrCreateOAuthUser, signToken } = require("../utils/oauthHelpers");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// ============================================================
// Passport-strategier (initialiseras endast om credentials finns)
// ============================================================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${API_BASE_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: "google",
            providerId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

// Hjälp-middleware: redirecta till frontend med token i hash
function oauthSuccessRedirect(req, res) {
  const token = signToken(req.user);
  // Token i hash istället för query - hash skickas inte till server-loggar
  res.redirect(`${FRONTEND_URL}/auth-callback#token=${token}`);
}

function oauthFailureRedirect(req, res) {
  res.redirect(`${FRONTEND_URL}/login?error=oauth-failed`);
}

// ============================================================
// Email + lösenord
// ============================================================

/**
 * POST /api/auth/register
 * Self-service registrering. Skapar user med roles=["user"].
 * Body: { email, password, name? }
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "E-post och lösenord krävs." });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Lösenordet måste vara minst 8 tecken." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(400)
        .json({ message: "En användare med den e-posten finns redan." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashed,
      name: name || "",
      providers: [{ provider: "password", providerId: email.toLowerCase() }],
      roles: ["user"],
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        roles: user.roles,
        place: user.place,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Kunde inte skapa konto.", error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Email + lösenord-inloggning.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !user.password) {
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Fel e-post eller lösenord." });
    }
    const token = signToken(user);
    res.json({
      token,
      message: "Inloggning lyckades!",
      user: {
        email: user.email,
        name: user.name,
        roles: user.roles || [],
        place: user.place,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Något gick fel.", error });
  }
});

// ============================================================
// Google OAuth
// ============================================================
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth-failed` }),
  oauthSuccessRedirect
);

// ============================================================
// Återställning / current user
// ============================================================

/**
 * GET /api/auth/me
 * Returnerar inloggad user (utan password).
 */
router.get("/me", authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Inte inloggad." });
  res.json({
    _id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    avatarUrl: req.user.avatarUrl,
    roles: req.user.roles,
    place: req.user.place,
  });
});

module.exports = router;
