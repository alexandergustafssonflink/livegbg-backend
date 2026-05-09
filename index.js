const express = require("express");
const app = express();
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const passport = require("passport");
const { MongoClient } = require("mongodb");
const eventsRoute = require("./routes/events");
const authRoute = require("./routes/auth");
const artistRoute = require("./routes/artist");
const proxyRoute = require("./routes/proxy");
const adminRoute = require("./routes/admin");
const favoritesRoute = require("./routes/favorites");
const merchRoute = require("./routes/merch");

dotenv.config();

// Passport används stateless (session: false) så vi behöver inga sessions
app.use(passport.initialize());

mongoose.connect(process.env.DB_CONNECT, () => console.log("CONNECTED TO DB"));

// Middleware

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "https://livegbg.vercel.app",
  "https://www.livegbg.se",
  "https://livegbg.se",
  "https://livesthlm.vercel.app",
  "https://livesthlm.se",
  "https://www.livesthlm.se",
];

app.use(function (req, res, next) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  // Preflight: svara direkt på OPTIONS innan vi når någon route.
  // Annars faller OPTIONS-requesten igenom till en 404 på endpointer
  // utan explicit OPTIONS-handler (t.ex. /api/favorites/:id), och
  // browsern blockerar den faktiska POST/DELETE.
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.use("/api/events", eventsRoute);
app.use("/api/artist", artistRoute);
app.use("/api/auth", authRoute);
app.use("/api/proxy", proxyRoute);
app.use("/api/admin", adminRoute);
app.use("/api/favorites", favoritesRoute);
app.use("/api/merch", merchRoute);

app.listen(process.env.PORT || 3000, () => console.log("Server is on!"));
