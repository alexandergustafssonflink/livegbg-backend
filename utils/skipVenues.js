/**
 * Venues vars event-länkar inte går att scrapa eller bearbeta automatiskt
 * (t.ex. Facebook-events utan publik HTML).
 *
 * Dessa skippas i ALLA backfill-pipelines:
 *   - backfillPageContent (vi hämtar inte sidtext)
 *   - backfillGenres      (vi klassar inte ens om det skulle finnas pageContent)
 *
 * Manuell genre-tagging via admin-UI får hantera dessa events.
 *
 * Lägg till nya venues här när vi upptäcker att de inte går att processa
 * — det är exakt en ändring på exakt en plats.
 */
const SKIP_PLACES = ["Potatisen"];

module.exports = SKIP_PLACES;
