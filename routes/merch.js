const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";

// Tillåtna storlekar för whitelistning av input
const ALLOWED_SIZES = ["S", "M", "L", "XL"];

// Pris i öre (Stripe kräver smallest unit). Ändra via env eller här.
const TSHIRT_PRICE_SEK = Number(process.env.MERCH_TSHIRT_PRICE_SEK || 349);
const TSHIRT_PRICE_ORE = TSHIRT_PRICE_SEK * 100;

/**
 * POST /api/merch/checkout
 * Body: { size: "S" | "M" | "L" | "XL", quantity?: number }
 *
 * Skapar en Stripe Checkout Session och returnerar URL:en som frontend
 * kan redirecta användaren till. Storleken läggs som metadata så vi vet
 * vilken variant vi ska beställa hos Gelato när ordern kommer in.
 */
router.post("/checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        message:
          "Stripe är inte konfigurerat. Sätt STRIPE_SECRET_KEY i .env och starta om servern.",
      });
    }

    const { size, quantity = 1 } = req.body;

    if (!ALLOWED_SIZES.includes(size)) {
      return res.status(400).json({
        message: `Ogiltig storlek. Tillåtna värden: ${ALLOWED_SIZES.join(", ")}`,
      });
    }

    const qty = Math.max(1, Math.min(Number(quantity) || 1, 10));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sek",
            unit_amount: TSHIRT_PRICE_ORE,
            product_data: {
              name: `LiveGBG T-shirt — Storlek ${size}`,
            },
          },
          quantity: qty,
        },
      ],
      // Ta in fraktadress automatiskt - vi accepterar Norden initialt
      shipping_address_collection: {
        allowed_countries: ["SE", "NO", "DK", "FI"],
      },
      // Metadata - så vi i admin/maillåda kan se vilken storlek att beställa
      metadata: {
        product: "tshirt",
        size,
        source: "livegbg-merch",
      },
      // Skicka även med på payment intent (visas i Stripe Dashboard)
      payment_intent_data: {
        metadata: { product: "tshirt", size, source: "livegbg-merch" },
      },
      success_url: `${FRONTEND_URL}/merch/tack?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/merch?avbruten=1`,
      locale: "sv",
    });

    res.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({
      message: "Kunde inte starta checkout.",
      error: error.message,
    });
  }
});

/**
 * GET /api/merch/info
 * Publik info om aktuell merch (pris, storlekar). Frontend hämtar detta
 * istället för att hårdkoda priset på två ställen.
 */
router.get("/info", (req, res) => {
  res.json({
    name: "LiveGBG T-shirt",
    priceSEK: TSHIRT_PRICE_SEK,
    currency: "SEK",
    sizes: ALLOWED_SIZES,
    available: !!stripe,
  });
});

module.exports = router;
