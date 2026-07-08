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
const analyticsRoute = require("./routes/analytics");
const sitemapRoute = require("./routes/sitemap");
const { startAnalyticsCleanup } = require("./jobs/cleanupAnalytics");
const nodeSchedule = require("node-schedule");

dotenv.config();

if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID) {
  const postNewConcertsToInstagram = require("./utils/postToInstagram");
  nodeSchedule.scheduleJob("30 8,17 * * *", async () => {
    try {
      const r = await postNewConcertsToInstagram({ maxPerRun: 5 });
      if (r.posted || r.failed) console.log("[instagram] Schemakörning:", r);
    } catch (err) {
      console.error("[instagram] Schemakörning kraschade:", err.message);
    }
  });
  console.log(
    "[instagram] Postningsschema aktivt (08:30 & 17:30 UTC, max 5/körning)"
  );
}

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
app.use("/api/analytics", analyticsRoute);
// Sitemap serveras på rot-nivå (inte /api) — exponeras som
// https://www.livegbg.se/sitemap.xml via rewrite i frontendens vercel.json
app.use("/", sitemapRoute);

// Starta schemalagt jobb för GDPR-städning av analytics-data
startAnalyticsCleanup();

app.listen(process.env.PORT || 3000, () => console.log("Server is on!"));
