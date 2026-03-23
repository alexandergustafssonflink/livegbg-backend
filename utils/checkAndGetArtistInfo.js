const Artist = require("../models/artist");
const axios = require("axios");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function generateSearchTerms(raw) {
  const base = String(raw || "").trim();
  const lower = base.toLowerCase();
  const variants = new Set([base]);

  const trySplit = (s, token, side = "left") => {
    if (s.includes(token)) {
      const parts = s.split(token);
      const picked = side === "left" ? parts[0] : parts[1];
      const cleaned = String(picked || "").trim();
      if (cleaned) variants.add(cleaned);
    }
  };

  trySplit(base, " + ");
  trySplit(base, "#");
  trySplit(base, " med ");
  trySplit(base, " och ");

  if (lower.includes("nytt datum")) {
    const [left, ...rest] = lower.split("nytt datum");
    const rightOriginal = base.slice(left.length + "nytt datum".length);
    variants.add(rightOriginal.trim());
  }

  if (lower.includes("i salongen")) {
    const idx = lower.indexOf("i salongen");
    variants.add(base.slice(0, idx).trim());
  }

  return Array.from(variants).filter(Boolean);
}

async function fetchShazam(term) {
  const key =
    process.env.VUE_APP_SHAZAM_KEY ||
    process.env.SHAZAM_KEY ||
    process.env.RAPIDAPI_KEY;

  if (!key) {
    console.error(
      "[Shazam] Saknar API-nyckel (VUE_APP_SHAZAM_KEY/ SHAZAM_KEY/ RAPIDAPI_KEY)."
    );
  }

  const options = {
    method: "GET",
    url: "https://shazam.p.rapidapi.com/search",
    params: { term, locale: "en-US", offset: "0", limit: "5" },
    headers: {
      "X-RapidAPI-Key": key || "",
      "X-RapidAPI-Host": "shazam.p.rapidapi.com",
    },
    timeout: 10000,
    validateStatus: (s) => s >= 200 && s < 500,
  };

  try {
    const { data, status } = await axios.request(options);
    if (status >= 400) {
      console.error(`[Shazam] HTTP ${status} för term="${term}". Svar:`, data);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[Shazam] Fel vid anrop för term="${term}":`, {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return null;
  }
}

function looksLikeMatch(apiData, candidateTerm) {
  const firstHitName =
    apiData?.artists?.hits?.[0]?.artist?.name ??
    apiData?.tracks?.hits?.[0]?.artist?.name ??
    apiData?.tracks?.hits?.[0]?.subtitle;

  if (!firstHitName) return false;

  const termFirst = String(candidateTerm).trim().split(/\s+/)[0]?.toLowerCase();
  const hitFirst = String(firstHitName).trim().split(/\s+/)[0]?.toLowerCase();

  return !!termFirst && !!hitFirst && (hitFirst.includes(termFirst) || termFirst.includes(hitFirst));
}

async function getArtistInfo(artistRaw) {
  const candidates = generateSearchTerms(artistRaw);

  for (const term of candidates) {
    const data = await fetchShazam(term);
    if (data && looksLikeMatch(data, term)) return data;
    await sleep(150);
  }
  return null;
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//  OBS: exakt namn och signatur enligt din begäran
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
async function checkandGetartistinfo(allEvents) {
  for (let i = 0; i < allEvents.length; i++) {
    const artistName = allEvents[i]?.title;
    if (!artistName) {
      console.warn(`[Artist] Event #${i} saknar title – hoppar över.`);
      continue;
    }

    try {
      const existing = await Artist.findOne({ name: artistName });
      if (!existing) {
        const artistInfo = await getArtistInfo(artistName);

        const artistDoc = new Artist({
          name: artistName,
          info: artistInfo ?? null,
          date: new Date(),
        });

        const saved = await artistDoc.save();
        console.log("[Artist] Sparad:", saved?._id, saved?.name);
      }
    } catch (err) {
      console.error(`[Artist] Fel vid hantering av "${artistName}":`, {
        message: err?.message,
        stack: err?.stack,
      });
    }

    await sleep(300);
  }
}

module.exports = checkandGetartistinfo;
