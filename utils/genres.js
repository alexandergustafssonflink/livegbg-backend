// Delad lista över giltiga genrer. Importeras av Concert-modellen för
// schema-validering och av admin-routerna för att kunna skicka tillåtna
// värden till frontend (så dropdown och backend håller sams).
const GENRES = [
  "rock",
  "indie",
  "pop",
  "jazz",
  "hiphop",
  "electronic",
  "folk",
  "klassiskt",
  "metal",
  "country",
  "soul",
  "blues",
  "världsmusik",
];

module.exports = GENRES;
