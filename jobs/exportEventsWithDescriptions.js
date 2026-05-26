/**
 * CLI-skript: hämta ut title + pageContent för events där pageContent finns.
 *
 * Använd för att inspektera vad den generiska extractor:n producerar
 * efter en backfill-körning.
 *
 * Användning:
 *   node jobs/exportEventsWithDescriptions.js
 *   CITY=Göteborg node jobs/exportEventsWithDescriptions.js
 *   VENUES=Pustervik,Oceanen node jobs/exportEventsWithDescriptions.js
 *   ONE_PER_VENUE=1 node jobs/exportEventsWithDescriptions.js
 *   LIMIT=25 node jobs/exportEventsWithDescriptions.js
 *   OUTPUT=./descriptions.json node jobs/exportEventsWithDescriptions.js
 *   TEXT_OUTPUT=./descriptions.txt node jobs/exportEventsWithDescriptions.js
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Concert = require("../models/concert");

const rootEnvPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: rootEnvPath });

async function main() {
  const limit = Number(process.env.LIMIT || 0);
  const city = process.env.CITY;
  const venues = process.env.VENUES
    ? process.env.VENUES.split(",").map((p) => p.trim()).filter(Boolean)
    : null;
  const onePerVenue =
    process.env.ONE_PER_VENUE === "1" || process.env.ONE_PER_VENUE === "true";
  const textOutputPath = process.env.TEXT_OUTPUT;
  const outputPath = process.env.OUTPUT;

  if (!process.env.DB_CONNECT) {
    throw new Error("DB_CONNECT saknas i miljövariabler.");
  }

  await mongoose.connect(process.env.DB_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const query = {
    pageContent: { $exists: true, $nin: [null, ""] },
  };

  if (city) query.city = city;
  if (venues && venues.length) query.venue = { $in: venues };

  const projection = {
    _id: 0,
    title: 1,
    venue: 1,
    date: 1,
    link: 1,
    pageContent: 1,
    pageContentFetchedAt: 1,
  };

  let events;
  if (onePerVenue) {
    // Plocka senaste hämtade event per venue — bra för att jämföra
    // resultatet av en FORCE=1 ONE_PER_VENUE=1-backfill.
    events = await Concert.aggregate([
      { $match: query },
      { $sort: { pageContentFetchedAt: -1, date: 1 } },
      { $group: { _id: "$venue", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $project: projection },
      { $sort: { venue: 1 } },
      ...(limit > 0 ? [{ $limit: limit }] : []),
    ]);
  } else {
    let dbQuery = Concert.find(query, projection).sort({
      date: 1,
      createdAt: 1,
    });
    if (limit > 0) dbQuery = dbQuery.limit(limit);
    events = await dbQuery.lean();
  }

  if (!events.length) {
    console.log("Inga event med pageContent hittades.");
    return;
  }

  const formatHeader = (event, index) => {
    const dateStr = event.date
      ? new Date(event.date).toISOString().slice(0, 10)
      : "";
    const meta = [event.venue, dateStr].filter(Boolean).join(" · ");
    const title = event.title || "(utan titel)";
    return `${index + 1}. ${title}${meta ? `  [${meta}]` : ""}`;
  };

  if (outputPath) {
    const absolutePath = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(absolutePath, JSON.stringify(events, null, 2), "utf8");
    console.log(`Skrev ${events.length} event till ${absolutePath}`);
    return;
  }

  if (textOutputPath) {
    const absolutePath = path.resolve(process.cwd(), textOutputPath);
    const textContent = events
      .map(
        (event, index) =>
          `${formatHeader(event, index)}\n${event.link || ""}\n\n${event.pageContent}`
      )
      .join("\n\n---\n\n");
    fs.writeFileSync(absolutePath, textContent, "utf8");
    console.log(`Skrev ${events.length} event till ${absolutePath}`);
    return;
  }

  events.forEach((event, index) => {
    console.log(`\n${formatHeader(event, index)}`);
    console.log(event.pageContent);
  });

  console.log(`\nTotalt: ${events.length} event med pageContent.`);
}

main()
  .catch((error) => {
    console.error("Fel vid export:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (error) {
      console.error("Fel vid disconnect:", error);
    }
  });
