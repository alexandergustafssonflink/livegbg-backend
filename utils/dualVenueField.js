/**
 * Mongoose-plugin som gör läsning bakåtkompatibel under övergångsperioden
 * från det gamla fältnamnet `place` till det nya `venue`.
 *
 * När den här pluginen är applicerad på en modell:
 *
 *   1. Den gamla `place`-kolumnen finns kvar i schemat som ett "dolt"
 *      legacy-fält. Mongoose droppar det inte vid save, men ny kod ska
 *      aldrig skriva till den direkt.
 *
 *   2. post('init') (körs när doc:et laddas från DB): om dokumentet
 *      saknar `venue` men har `place`, kopieras värdet över (trimmat
 *      och lowercase:at). Existerande `venue`-värden normaliseras också
 *      så in-memory state är konsekvent oavsett vilken case som finns i
 *      DB:n från historisk data.
 *
 *   3. pre('save'): säkerställer att `venue` är satt och rensar `place`
 *      när ett dokument sparas. Det här gör save:s till en självläkande
 *      migration - varje gång ett dokument touchas hamnar det i nya
 *      schemat.
 *
 *   4. pre('find'/'findOne'/etc): expanderar { venue: X } i filter till
 *      { $or: [{ venue: X }, { place: <case-insensitive> }] } så queries
 *      hittar dokument oavsett om DB:n har migrerats än. Hanterar både
 *      ren equality, $in och $nin.
 *
 * När du har kört jobs/renamePlaceToVenue.js mot prod och inga dokument
 * längre har `place`-fältet är det säkert att ta bort pluginen och rensa
 * legacy-fältet ur schemat.
 */

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeString(value) {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}

function rewriteVenueFilter(filter) {
  if (!filter || typeof filter !== "object") return;

  // Recurse först så nästade $and/$or behandlas
  if (Array.isArray(filter.$or)) filter.$or.forEach(rewriteVenueFilter);
  if (Array.isArray(filter.$and)) filter.$and.forEach(rewriteVenueFilter);

  if (!Object.prototype.hasOwnProperty.call(filter, "venue")) return;

  const venueValue = filter.venue;
  delete filter.venue;

  let placeClause;
  if (typeof venueValue === "string") {
    // Case-insensitive match på legacy place (det fältet är inte normaliserat)
    placeClause = {
      place: { $regex: `^${escapeRegex(venueValue)}$`, $options: "i" },
    };
  } else if (venueValue && typeof venueValue === "object") {
    if (Array.isArray(venueValue.$in)) {
      const lowered = venueValue.$in.map((v) =>
        typeof v === "string" ? v.toLowerCase() : v
      );
      placeClause = { place: { $in: lowered } };
    } else if (Array.isArray(venueValue.$nin)) {
      const lowered = venueValue.$nin.map((v) =>
        typeof v === "string" ? v.toLowerCase() : v
      );
      // För $nin är OR fel - vi vill ha matchningar som passar BÅDA fältens
      // exklusioner. Använd $and så queryn håller.
      const andClause = filter.$and || [];
      andClause.push({ venue: venueValue });
      andClause.push({ place: { $nin: lowered } });
      filter.$and = andClause;
      return;
    } else {
      // Allt annat (t.ex. $regex eller komplexa operatorer): återanvänd
      // samma operator på place också
      placeClause = { place: venueValue };
    }
  } else {
    placeClause = { place: venueValue };
  }

  const andClause = filter.$and || [];
  andClause.push({ $or: [{ venue: venueValue }, placeClause] });
  filter.$and = andClause;
}

// Kopierar `place` → `venue` på ett plain-object (för lean-queries) eller
// Mongoose-doc. Använder `normalize`-flaggan från schemat för att veta om
// värdet ska lowercaseas (ja för User/ExternalEvent, nej för Concert vars
// venue används som display-data).
function applyVenueFallback(doc, normalize) {
  if (!doc || typeof doc !== "object") return;
  if (!doc.venue && doc.place) {
    doc.venue = normalize ? normalizeString(doc.place) : doc.place;
  }
}

// Säkerställer att inclusion-projektioner som inkluderar `venue` också tar
// med `place` så fallback-läsningen har något att gå på. Lämnar exclusion-
// projektioner ({ venue: 0 }) orörda.
function ensurePlaceInProjection(query) {
  const proj = query.projection();
  if (!proj) return;
  const venueIncluded = proj.venue === 1 || proj.venue === true;
  const placeAlreadySet = "place" in proj;
  if (venueIncluded && !placeAlreadySet) {
    proj.place = 1;
  }
}

function dualVenueField(schema, options = {}) {
  // Om venue-fältet är deklarerat med lowercase: true (User, ExternalEvent)
  // ska vi normalisera vid fallback. För Concert ska scrapad case bevaras.
  const venuePath = schema.path("venue");
  const normalize =
    options.normalize !== undefined
      ? options.normalize
      : !!(venuePath && venuePath.options && venuePath.options.lowercase);

  // Lägg till `place` som hidden legacy-fält så Mongoose inte droppar
  // existerande värden vid save (innan vi har hunnit migrera).
  if (!schema.path("place")) {
    schema.add({ place: { type: String, select: true } });
  }

  schema.post("init", function () {
    applyVenueFallback(this, normalize);
  });

  schema.pre("save", function (next) {
    applyVenueFallback(this, normalize);
    // När venue är satt är place obsolet - rensa det progressivt så DB:n
    // läker över tid utan att vi behöver köra batch-migrationen.
    if (this.venue && this.place) {
      this.place = undefined;
    }
    next();
  });

  const FILTER_HOOKS = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "findOneAndRemove",
    "count",
    "countDocuments",
    "updateMany",
    "updateOne",
    "deleteMany",
    "deleteOne",
  ];

  FILTER_HOOKS.forEach((op) => {
    schema.pre(op, function () {
      const filter = this.getFilter();
      rewriteVenueFilter(filter);
    });
  });

  // Säkerställ att lean-queries som projicerar `venue: 1` också får place
  // med tillbaka, annars kan vi inte falla tillbaka på det.
  ["find", "findOne", "findOneAndUpdate"].forEach((op) => {
    schema.pre(op, function () {
      ensurePlaceInProjection(this);
    });
  });

  // post-init körs INTE på .lean()-queries eftersom Mongoose då hoppar över
  // doc-konstruktion. Vi normaliserar manuellt på lean-resultaten så att
  // konsumenten alltid ser ett populerat `venue`-fält.
  schema.post("find", function (docs) {
    if (!Array.isArray(docs)) return;
    docs.forEach((d) => applyVenueFallback(d, normalize));
  });

  schema.post("findOne", function (doc) {
    applyVenueFallback(doc, normalize);
  });

  schema.post("findOneAndUpdate", function (doc) {
    applyVenueFallback(doc, normalize);
  });
}

module.exports = dualVenueField;
