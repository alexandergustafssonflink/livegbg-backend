const express = require("express");
const app = express();
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
const eventsRoute = require("./routes/events");
const artistRoute = require("./routes/artist");
// const proxyRoute = require("./routes/proxy");

dotenv.config();

mongoose.connect(process.env.DB_CONNECT, () => console.log("CONNECTED TO DB"));

// Middleware

app.use(function (req, res, next) {
  const allowedOrigins = [
    "http://localhost:8080",
    "https://livegbg.vercel.app",
    "https://www.livegbg.se",
    "https://livegbg.se",
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // res.header("Access-Control-Allow-Origin", "http://localhost:8080"); // update to match the domain you will make the request from
  // res.header("Access-Control-Allow-Origin", "https://fakturera-mera.vercel.app"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, auth-token"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  next();
});

app.use(express.json());

app.use("/api/events", eventsRoute);
app.use("/api/artist", artistRoute);
// app.use("/api/proxy", proxyRoute);

app.listen(process.env.PORT || 3000, () => console.log("Server is on!"));
