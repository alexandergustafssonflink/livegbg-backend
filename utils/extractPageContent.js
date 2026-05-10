/**
 * Generisk extractor för event-sidors textinnehåll.
 *
 * Vi tar ALL meningsfull text på sidan (ingen targeting av specifika klasser),
 * rensar bort uppenbar boilerplate (nav, footer, script, cookie-banners etc),
 * och låter en LLM (i ett senare steg) extrahera genre / sammanfattning.
 *
 * Designprinciper:
 *  - Konservativ rensning: hellre lite skräp kvar än att råka klippa bort
 *    riktig beskrivning. LLM:en filtrerar bort resten.
 *  - Föredrar <main>/<article> om de finns, annars hela body. Detta tar
 *    bort sidebar med "andra event på venue:t" på de flesta moderna teman.
 *  - Cap på maxChars (default 6000) så vi inte sparar megabyte i Mongo
 *    och inte slänger orimligt många tokens på Haiku.
 *
 * @param {object} browser - puppeteer browser instance
 * @param {string} url - event-detalj-URL
 * @param {object} [options]
 * @param {number} [options.minLength=100] - minsta acceptabla textlängd
 * @param {number} [options.maxChars=6000] - cap på output
 * @param {number} [options.timeout=30000] - navigations-timeout i ms
 * @returns {Promise<string|null>}
 */
async function extractPageContent(browser, url, options = {}) {
  if (!url) return null;
  const { minLength = 100, maxChars = 6000, timeout = 30000 } = options;

  const page = await browser.newPage();
  try {
    page.setDefaultNavigationTimeout(timeout);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    const text = await page.evaluate(() => {
      // OBS: vi muterar LIVE DOM istället för att klona. Anledningen är
      // att .innerText på en detached (klonad) node inte fungerar
      // tillförlitligt i headless Chrome — utan layout-kontext returnerar
      // den ofta tom sträng. Live DOM har layout och innerText funkar.
      // Sidan stängs direkt efter så inga sidoeffekter.
      const root = document.body;
      if (!root) return "";

      // Element som aldrig bidrar till event-info — riv bort innan extraktion.
      // Bredare än per-venue-listan eftersom vi inte vet vilket tema vi är på.
      // Notera: vi matchar både semantiska taggar (<footer>) OCH id/class-
      // mönster (<div id="footer">), eftersom många äldre teman (t.ex. Trägår'n)
      // inte använder semantisk HTML5.
      const removeSelectors = [
        // Tekniska/icke-textuella element
        "script",
        "style",
        "noscript",
        "template",
        "svg",
        "iframe",
        "embed",
        "object",
        // Semantiska sid-strukturs-taggar.
        // OBS: vi tar INTE bort <header> blint — vissa teman (Elementor med
        // "elementor-location-single") använder <header> som content-wrapper
        // för hela event-sidan. Vi targets bara header som ÄR navigation.
        "nav",
        "footer",
        "aside",
        'header[role="banner"]',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
        '[role="complementary"]',
        '[role="search"]',
        // Footer som <div id="footer"> eller class-varianter
        // (.footer, .site-footer, .top-footer, .page-footer, .main-footer)
        '[id*="footer" i]',
        '[class*="footer" i]',
        // Page-level header som <div id="header"> samt explicita
        // site/page/main-header (men INTE entry-header etc — det är säkert
        // eftersom matchen kräver "site/page/main-" prefix).
        // Inkluderar även Elementors `.elementor-location-header` som är
        // deras template-wrapper för site-header (skiljer sig från
        // `.elementor-location-single` som ÄR content).
        '[id*="header" i]',
        ".site-header",
        ".page-header",
        ".main-header",
        ".entry-header",
        ".elementor-location-header",
        // Menyer / navigation utan <nav>-tag.
        // OBS: vi använder INTE [id*="menu" i] eller .mobile-menu — de är
        // för breda. Nefertiti har t.ex. en .mobile-menu som wrappar HELA
        // sidans content (off-canvas-pattern), och tog då bort allt.
        // Specifika klassnamn nedan är säkrare.
        ".main-menu",
        ".primary-menu",
        ".nav-menu",
        ".main-navigation",
        ".primary-navigation",
        ".menu-container",
        // Cookie-banners (vanliga klass/id-mönster)
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
        // Newsletter / sociala / delning
        '[class*="newsletter" i]',
        '[class*="social-share" i]',
        '[class*="share-buttons" i]',
        // Skip-links för screen readers
        ".skip-link",
        ".screen-reader-text",
        ".sr-only",
        ".visually-hidden",
        // Biljett-embeds som inte renderar synlig text i SSR
        "billetto-widget",
        "tickster-widget",
        // Skip "andra event"-listor (vanliga klassnamn)
        '[class*="upcoming-events" i]',
        '[class*="related-events" i]',
        '[class*="other-events" i]',
        // Kommentar-sektioner
        "#comments",
        ".comments",
        ".comment-section",
        // Popups / modaler — Nefertiti använder Popup Maker (PUM) plugin,
        // andra sajter har Markethype eller egna modal-implementationer.
        // Dessa är ofta auto-open newsletter-signups och kan vara 4000+ chars
        // som kompletit dränker den riktiga sidan.
        '[class*="popmake" i]',
        '[id*="popmake" i]',
        '[class*="pum-" i]',
        '[id*="pum-" i]',
        '[class*="popup" i]',
        '[id*="popup" i]',
        '[class*="modal" i]',
        '[id*="modal" i]',
        '[class*="overlay" i]',
        "#markethype-form-container",
        '[id*="markethype" i]',
      ];
      for (const sel of removeSelectors) {
        try {
          root.querySelectorAll(sel).forEach((el) => el.remove());
        } catch {
          // Ogiltiga selektorer på vissa Chrome-versioner — ignorera
        }
      }

      // Föredra <main> > <article> > [role="main"] > body, men BARA om
      // containern har substantiellt innehåll (≥300 chars). Annars är den
      // troligen ett tomt skal eller en stub (t.ex. Nefertitis
      // <article class="coming-event"> som bara är en länk till nästa event).
      function pick(selector) {
        const el = root.querySelector(selector);
        if (!el) return null;
        const len = (el.innerText || "").trim().length;
        return len >= 300 ? el : null;
      }
      const container =
        pick("main") ||
        pick("article") ||
        pick('[role="main"]') ||
        root;

      return (container.innerText || "").trim();
    });

    if (!text) return null;

    const cleaned = cleanText(text, maxChars);
    if (!cleaned || cleaned.length < minLength) return null;

    return cleaned;
  } finally {
    await page.close().catch(() => {});
  }
}

function cleanText(text, maxChars) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

module.exports = extractPageContent;
module.exports.cleanText = cleanText;
