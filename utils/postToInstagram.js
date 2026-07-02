const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const Concert = require("../models/concert");
const Setting = require("../models/setting");

/**
 * Postar nya konserter till @livegbg.se på Instagram via Meta Graph API
 * (Instagram Login-flödet, https://graph.instagram.com).
 *
 * Flöde per event:
 *   1. Bilden laddas upp till Cloudinary och konverteras till JPEG i
 *      1080x1350 (4:5) — Instagram accepterar bara JPEG via publik URL
 *      och har hårda krav på aspect ratio. Scrapade bilder är ofta
 *      webp/png i godtyckliga format, så vi normaliserar alltid.
 *   2. Media-container skapas hos Instagram med bild + caption.
 *   3. Containern pollas tills status FINISHED, sedan publiceras den.
 *   4. Concert.instagramPostedAt sätts — eventet postas aldrig igen.
 *
 * Skyddsmekanismer:
 *   - Bara events med firstSeenAt inom maxAgeDays (default 3) postas.
 *     Det gör att den befintliga backloggen (hundratals gamla events)
 *     aldrig spammas ut — bara sådant som är NYTT sedan featuren driftsattes.
 *   - Max maxPerRun (default 5) inlägg per körning, med delay emellan.
 *     Scrapern kör var 4:e timme, så en stor släpp-dag sprids ut naturligt.
 *   - Misslyckade postningar markeras med instagramPostFailedAt och
 *     retryas inte inom 3 dagar.
 *
 * Tokenhantering:
 *   - Långlivade Instagram-tokens gäller 60 dagar och måste refreshas.
 *     Token seedas från env IG_ACCESS_TOKEN till settings-collectionen
 *     och refreshas därefter automatiskt var 7:e dag via
 *     /refresh_access_token. Det refreshade värdet sparas i DB så det
 *     överlever både omstarter och env-värdet som blir gammalt.
 */

const GRAPH_BASE = "https://graph.instagram.com/v23.0";
const TOKEN_SETTING_KEY = "igAccessToken";
const TOKEN_REFRESH_INTERVAL_DAYS = 7;
const FAILED_RETRY_DAYS = 3;

// OBS: cloudinary.config() anropas lazily i prepareImage() och inte här på
// modulnivå — gbg-scraper.js kör require() FÖRE dotenv.config(), så env-
// variablerna finns inte när modulen laddas.
let cloudinaryConfigured = false;
function ensureCloudinaryConfig() {
  if (cloudinaryConfigured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  cloudinaryConfigured = true;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Hämtar aktuell token. Seedar från env första gången, refreshar därefter
 * automatiskt om det gått mer än TOKEN_REFRESH_INTERVAL_DAYS sedan senaste
 * refresh. Refresh kräver att token är minst 24h gammal — misslyckas den
 * (t.ex. för färsk token) används befintligt värde tyst vidare.
 */
async function getAccessToken() {
  let setting = await Setting.findOne({ key: TOKEN_SETTING_KEY });

  if (!setting || !setting.value) {
    if (!process.env.IG_ACCESS_TOKEN) return null;
    setting = await Setting.findOneAndUpdate(
      { key: TOKEN_SETTING_KEY },
      { value: process.env.IG_ACCESS_TOKEN },
      { upsert: true, new: true }
    );
    console.log("[instagram] Token seedad från env till settings.");
    return setting.value;
  }

  const needsRefresh =
    setting.updatedAt < daysAgo(TOKEN_REFRESH_INTERVAL_DAYS);

  if (needsRefresh) {
    try {
      const res = await axios.get(
        "https://graph.instagram.com/refresh_access_token",
        {
          params: {
            grant_type: "ig_refresh_token",
            access_token: setting.value,
          },
        }
      );
      if (res.data && res.data.access_token) {
        setting.value = res.data.access_token;
        await setting.save();
        console.log(
          `[instagram] Token refreshad, giltig i ${Math.round(
            res.data.expires_in / 86400
          )} dagar.`
        );
      }
    } catch (err) {
      console.warn(
        "[instagram] Token-refresh misslyckades (fortsätter med befintlig):",
        err.response?.data?.error?.message || err.message
      );
    }
  }

  return setting.value;
}

/**
 * Normaliserar en scrapad eventbild till Instagram-kompatibel JPEG:
 * 1080x1350 (4:5), auto-crop mot motivets fokuspunkt.
 */
async function prepareImage(imageUrl, concertId) {
  ensureCloudinaryConfig();
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "instagram-posts",
    public_id: String(concertId),
    overwrite: true,
    format: "jpg",
    transformation: [
      { width: 1080, height: 1350, crop: "fill", gravity: "auto" },
    ],
  });
  return result.secure_url;
}

function formatSwedishDate(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Stockholm",
  }).format(new Date(date));
}

function buildCaption(concert) {
  const lines = [
    `🎶 ${concert.title}`,
    `📍 ${concert.venue}, Göteborg`,
    `🗓 ${formatSwedishDate(concert.date)}`,
    "",
  ];

  const tags = ["#livemusik", "#göteborg", "#konsert", "#livegbg"];
  // Genre-hashtag om AI:n (eller admin) hunnit klassa eventet
  if (concert.genre) {
    tags.push(`#${concert.genre.replace(/[^a-zåäö0-9]/gi, "")}`);
  }
  lines.push(tags.join(" "));

  return lines.join("\n");
}

/** Pollar media-containern tills den är redo att publiceras. */
async function waitForContainer(containerId, accessToken) {
  for (let i = 0; i < 15; i++) {
    const res = await axios.get(`${GRAPH_BASE}/${containerId}`, {
      params: { fields: "status_code", access_token: accessToken },
    });
    const status = res.data.status_code;
    if (status === "FINISHED") return true;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Media-container fick status ${status}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Media-container blev aldrig FINISHED (timeout)");
}

/** Postar ETT event till Instagram. Kastar vid fel. */
async function postConcert(concert, accessToken, igUserId) {
  const jpegUrl = await prepareImage(concert.imageUrl, concert._id);
  const caption = buildCaption(concert);

  const containerRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media`,
    null,
    {
      params: {
        image_url: jpegUrl,
        caption,
        access_token: accessToken,
      },
    }
  );
  const containerId = containerRes.data.id;

  await waitForContainer(containerId, accessToken);

  const publishRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media_publish`,
    null,
    {
      params: { creation_id: containerId, access_token: accessToken },
    }
  );

  return publishRes.data.id; // media-id på det publicerade inlägget
}

/**
 * Huvudfunktion: hittar opostade nya events och postar dem.
 *
 * @param {object} opts
 * @param {number} opts.maxPerRun   max antal inlägg per körning (default 5)
 * @param {number} opts.maxAgeDays  posta bara events först sedda inom N dagar (default 3)
 * @param {number} opts.delayMs     paus mellan inlägg (default 5000)
 * @param {boolean} opts.dryRun     logga vad som skulle postas utan att posta
 */
async function postNewConcertsToInstagram({
  maxPerRun = 5,
  maxAgeDays = 3,
  delayMs = 5000,
  dryRun = false,
} = {}) {
  const igUserId = process.env.IG_USER_ID;
  const accessToken = await getAccessToken();

  if (!igUserId || !accessToken) {
    console.log("[instagram] IG_USER_ID/IG_ACCESS_TOKEN saknas — skippar.");
    return { posted: 0, failed: 0, skipped: 0 };
  }

  const queue = await Concert.find({
    isActive: true,
    isNotLiveMusic: { $ne: true },
    instagramPostedAt: null,
    imageUrl: { $nin: [null, ""] },
    date: { $gte: new Date() },
    firstSeenAt: { $gte: daysAgo(maxAgeDays) },
    $or: [
      { instagramPostFailedAt: null },
      { instagramPostFailedAt: { $lt: daysAgo(FAILED_RETRY_DAYS) } },
    ],
  })
    .sort({ firstSeenAt: 1 })
    .limit(maxPerRun);

  if (queue.length === 0) {
    console.log("[instagram] Inga nya events att posta.");
    return { posted: 0, failed: 0, skipped: 0 };
  }

  let posted = 0;
  let failed = 0;

  for (const concert of queue) {
    const label = `"${concert.title}" (${concert.venue})`;
    if (dryRun) {
      console.log(`[instagram] DRY RUN — skulle posta: ${label}`);
      console.log(buildCaption(concert));
      posted++;
      continue;
    }

    try {
      const mediaId = await postConcert(concert, accessToken, igUserId);
      concert.instagramPostedAt = new Date();
      concert.instagramPostFailedAt = undefined;
      await concert.save();
      posted++;
      console.log(`[instagram] Postade ${label} (media ${mediaId})`);
    } catch (err) {
      concert.instagramPostFailedAt = new Date();
      await concert.save();
      failed++;
      console.error(
        `[instagram] Misslyckades med ${label}:`,
        err.response?.data?.error?.message || err.message
      );
    }

    if (concert !== queue[queue.length - 1]) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { posted, failed, skipped: queue.length - posted - failed };
}

module.exports = postNewConcertsToInstagram;
module.exports.buildCaption = buildCaption;
module.exports.getAccessToken = getAccessToken;
