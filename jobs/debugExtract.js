/**
 * Debug-script: kör extractPageContent mot en URL och printa exakt
 * vad som returneras (eller null + varför).
 *
 * Användning:
 *   node jobs/debugExtract.js https://www.nefertiti.se/nefertiti_event/gosta-berlings-saga-2/
 */
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const dotenv = require("dotenv");
const extractPageContent = require("../utils/extractPageContent");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node jobs/debugExtract.js <url>");
    process.exit(1);
  }

  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  try {
    // Lägg till en parallell call som hämtar BARA råtexten (utan removeSelectors)
    // så vi ser hur stor body är innan vi börjar rensa.
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const rawBody = await page.evaluate(
      () => (document.body ? document.body.innerText.length : 0)
    );
    const articleLen = await page.evaluate(() => {
      const a = document.querySelector("article");
      return a ? (a.innerText || "").length : null;
    });
    const mainLen = await page.evaluate(() => {
      const m = document.querySelector("main");
      return m ? (m.innerText || "").length : null;
    });
    await page.close();

    console.log(`URL: ${url}`);
    console.log(`Raw body length: ${rawBody}`);
    console.log(`<main> length: ${mainLen}`);
    console.log(`<article> length: ${articleLen}`);
    console.log("---");

    // Step-by-step debug: kör varje selector och se vad den tar bort
    const debugPage = await browser.newPage();
    await debugPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const stepLog = await debugPage.evaluate(() => {
      const removeSelectors = [
        "script","style","noscript","template","svg","iframe","embed","object",
        "nav","footer","aside",'header[role="banner"]',
        '[role="navigation"]','[role="banner"]','[role="contentinfo"]','[role="complementary"]','[role="search"]',
        '[id*="footer" i]','[class*="footer" i]',
        '[id*="header" i]','.site-header','.page-header','.main-header','.entry-header','.elementor-location-header',
        '[id*="menu" i]','.main-menu','.primary-menu','.nav-menu','.main-navigation','.primary-navigation','.menu-container','.mobile-menu',
        '[id*="cookie" i]','[class*="cookie" i]','[id*="consent" i]','[class*="consent" i]','[id*="gdpr" i]','[class*="gdpr" i]',
        '[class*="newsletter" i]','[class*="social-share" i]','[class*="share-buttons" i]',
        ".skip-link",".screen-reader-text",".sr-only",".visually-hidden",
        "billetto-widget","tickster-widget",
        '[class*="upcoming-events" i]','[class*="related-events" i]','[class*="other-events" i]',
        "#comments",".comments",".comment-section",
        '[class*="popmake" i]','[id*="popmake" i]','[class*="pum-" i]','[id*="pum-" i]',
        '[class*="popup" i]','[id*="popup" i]','[class*="modal" i]','[id*="modal" i]','[class*="overlay" i]',
        "#markethype-form-container",'[id*="markethype" i]',
      ];
      const log = [];
      const root = document.body;
      let lenBefore = (root.innerText || "").trim().length;
      log.push({ step: "INITIAL", len: lenBefore });
      for (const sel of removeSelectors) {
        try {
          const els = root.querySelectorAll(sel);
          if (!els.length) continue;
          els.forEach((el) => el.remove());
          const lenAfter = (root.innerText || "").trim().length;
          if (lenAfter !== lenBefore) {
            log.push({ sel, removed: els.length, lenBefore, lenAfter, delta: lenBefore - lenAfter });
            lenBefore = lenAfter;
          }
        } catch {}
      }
      const finalText = (root.innerText || "").trim();
      log.push({ step: "AFTER_REMOVE", len: finalText.length });
      log.push({ step: "FINAL_PREVIEW", text: finalText.slice(0, 300) });
      return log;
    });
    await debugPage.close();

    console.log("Step-by-step removal log:");
    for (const entry of stepLog) console.log(JSON.stringify(entry));
    console.log("---");

    const result = await extractPageContent(browser, url);
    if (result === null) {
      console.log("extractPageContent returned NULL");
    } else {
      console.log(`extractPageContent length: ${result.length}`);
      console.log("--- FIRST 400 ---");
      console.log(result.slice(0, 400));
      console.log("--- LAST 200 ---");
      console.log(result.slice(-200));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
