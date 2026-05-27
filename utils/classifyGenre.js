/**
 * Klassificera en konsert i en av de fördefinierade genrerna med Claude Haiku.
 *
 * Använder tool_use så Claude alltid returnerar valid JSON enligt schemat —
 * ingen prompt-baserad JSON-parsing krävs. Modellen tvingas anropa vårt
 * classify_concert_genre-verktyg.
 *
 * Bumpa PROMPT_VERSION när du ändrar prompt eller modell — då kan vi
 * re-klassa allt med den gamla versionen via ett enkelt query.
 */
const Anthropic = require("@anthropic-ai/sdk");
const GENRES = require("./genres");

const PROMPT_VERSION = "v1";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_INPUT_CHARS = 4000; // ~1500 tokens, lämnar marginal till context

const SYSTEM_PROMPT = `Du klassificerar svenska/internationella musikkonserter i exakt en av dessa genrer:
${GENRES.map((g) => `- ${g}`).join("\n")}

Riktlinjer:
- Om beskrivningen explicit nämner genre/stil → hög confidence (0.85-1.0).
- Om du måste härleda genre från kända artistnamn eller indirekta ledtrådar → medel confidence (0.5-0.8).
- Om beskrivningen är för generisk eller tvetydig → låg confidence (0.0-0.5).
- Returnera genre = null om ingen genre i listan passar (t.ex. komik, teater, DJ-set utan genre-info).
- Om evenmanget INTE är livemusik alls (t.ex. teater, stand-up, föreläsning, DJ-set utan musiker), sätt isNotLiveMusic=true och genre=null.
- Använd ALDRIG genrer utanför listan. Om en konsert är "indie-folk", välj antingen "indie" eller "folk" baserat på vad som dominerar.
- Lämna alltid en kort reasoning (1-2 meningar) som motiverar valet.`;

const TOOL = {
  name: "classify_concert_genre",
  description:
    "Klassificera en konsert efter musikgenre baserat på titel, venue och beskrivning.",
  input_schema: {
    type: "object",
    properties: {
      genre: {
        type: ["string", "null"],
        enum: [...GENRES, null],
        description:
          "En av de tillåtna genrerna, eller null om ingen passar tillräckligt bra.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Hur säker du är på klassningen, från 0 (helt osäker) till 1 (helt säker).",
      },
      isNotLiveMusic: {
        type: "boolean",
        description:
          "True om evenmanget INTE är livemusik (t.ex. teater, stand-up, föreläsning). Då sätts genre=null automatiskt.",
      },
      reasoning: {
        type: "string",
        description:
          "Kort motivering (1-2 meningar) på svenska som förklarar varför just denna genre och confidence.",
      },
    },
    required: ["genre", "confidence", "isNotLiveMusic", "reasoning"],
  },
};

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY saknas i miljövariabler.");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Klassificerar en concert. Förutsätter att concert.pageContent finns.
 *
 * @param {object} concert - { title, venue, pageContent, date? }
 * @returns {Promise<{ genre: string|null, confidence: number, isNotLiveMusic: boolean, reasoning: string }>}
 */
async function classifyGenre(concert) {
  if (!concert || !concert.pageContent) {
    throw new Error("classifyGenre: concert.pageContent saknas");
  }

  const truncated = concert.pageContent.slice(0, MAX_INPUT_CHARS);
  const userMessage = [
    `Titel: ${concert.title || "(okänd)"}`,
    `Venue: ${concert.venue || "(okänd)"}`,
    "",
    "Sidans innehåll:",
    truncated,
  ].join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "classify_concert_genre" },
    messages: [{ role: "user", content: userMessage }],
  });

  // Med tool_choice forced får vi alltid en tool_use-block i svaret.
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || !toolUse.input) {
    throw new Error(
      `classifyGenre: oväntat svar från modellen (inget tool_use): ${JSON.stringify(response.content).slice(0, 200)}`
    );
  }

  const { genre, confidence, isNotLiveMusic, reasoning } = toolUse.input;

  // Validera schema-output (Claude följer det nästan alltid, men paranoia)
  const validGenre = genre === null || GENRES.includes(genre);
  if (!validGenre) {
    throw new Error(`classifyGenre: ogiltig genre returnerad: ${genre}`);
  }
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error(
      `classifyGenre: ogiltig confidence: ${confidence}`
    );
  }
  if (typeof isNotLiveMusic !== "boolean") {
    throw new Error(
      `classifyGenre: isNotLiveMusic måste vara boolean, fick: ${typeof isNotLiveMusic}`
    );
  }

  return { genre, confidence, isNotLiveMusic: isNotLiveMusic || false, reasoning: reasoning || "" };
}

module.exports = classifyGenre;
module.exports.PROMPT_VERSION = PROMPT_VERSION;
module.exports.MODEL = MODEL;
