# Phase 1 — Checkout, Orders and Inventory

Branch `phase-1-checkout`. Adds Stripe checkout (card, USD), order capture with
email confirmations, and inventory tracking on Supabase. Nothing goes live
until the env vars below exist; without them the buy buttons quietly fall back
to WhatsApp, so merging is safe at any time.

## Files

| File | Purpose |
|---|---|
| `sql/phase1-commerce.sql` | DB migration: products, orders, inventory movements. Already applied to Supabase project `mwfnvqsyvvzpkjwqasbk`. |
| `api/create-checkout.js` | POST endpoint: validates SKU and stock, creates the Stripe Checkout Session, returns `{ url }`. |
| `api/stripe-webhook.js` | Stripe webhook: verifies signature, inserts the order, decrements stock, emails customer and admin, optional TikTok event. |
| `assets/checkout.js` | Shared front-end handler for the buy buttons. |
| `gracias.html` | Order confirmation page (Stripe success redirect). |
| Product pages (3) | `producto-recoverypro.html`, `producto-radiancemax.html`, `producto-vitacharge.html` got a Comprar button. |

## Environment variables (Vercel, Production + Preview)

Required before checkout can work:

| Var | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` on Preview, `sk_live_...` on Production). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint (`whsec_...`). One per endpoint: the preview endpoint and the production endpoint have different secrets. |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (Project Settings > API > service_role). Never expose it in front-end code. |
| `SHIPPING_USD` | Flat shipping in USD. Defaults to `10.00` if unset. |

Optional:

| Var | Value |
|---|---|
| `TIKTOK_PIXEL_ID` + `TIKTOK_ACCESS_TOKEN` | If both exist, the webhook sends a CompletePayment event (email sha256-hashed) to TikTok Events API. Silently skipped otherwise. |
| `FREE_SHIPPING_THRESHOLD` | OFF by default. Set to a positive number (in the product currency) to enable free shipping above that subtotal. |
| `SHIPPING_MXN` | Only used if a product is ever switched to MXN. Defaults to `149.00`. |

`RESEND_API_KEY` is already configured (used by the quiz emails).

## Stripe dashboard setup

1. Create the Stripe account and activate it for Mexico.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Developers > Webhooks > Add endpoint: `https://biogradix.com/api/stripe-webhook`.
   Subscribe to `checkout.session.completed` and
   `checkout.session.async_payment_succeeded` (the second one matters only if
   OXXO/MXN is enabled later; adding it now costs nothing).
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Launch is CARD-ONLY: OXXO cannot process USD. The code already adds OXXO
   automatically for any product whose `currency` is `MXN`, so enabling OXXO
   later is: activate OXXO in Stripe payment methods, then update the product
   rows (see below). No code change.

## Prices, stock and currency

Everything lives in the `biogradix_products` table (Supabase). Seeded catalog:
5 SKUs (`bpc-157`, `mots-c`, `tb-500`, `ghk-cu`, `nad-plus`), each one pack of
20 patches, `340.00 USD`, stock `120`. To change price or restock:

```sql
update public.biogradix_products set price = 340.00 where sku = 'bpc-157';
update public.biogradix_products set stock = stock + 100 where sku = 'bpc-157';
-- switch a product to MXN later (checkout follows the row, OXXO turns on):
update public.biogradix_products set currency = 'MXN', price = 5800.00 where sku = 'bpc-157';
```

Restocks should also get a row in `biogradix_inventory_movements`
(`reason = 'restock'`, positive `delta`) so the movement history stays honest.
Sales are logged automatically by the webhook.

## Page-to-SKU mapping

The mapping is the `data-sku` attribute on each page's buy button — one
obvious place, survives page renames and the upcoming peptide-name rebrand
without code changes:

| Page | data-sku |
|---|---|
| producto-recoverypro.html | `bpc-157` |
| producto-radiancemax.html | `ghk-cu` |
| producto-vitacharge.html | `nad-plus` |

`mots-c` and `tb-500` are seeded and sellable but get their buy buttons during
the rebrand track, once the owner confirms which pages sell them. To add a
buy button to any page later:

1. Add next to the page's hero WhatsApp CTA (one line, change the sku):
   `<button type="button" onclick="startCheckout(this)" data-sku="mots-c" data-i18n="buy-cta" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--bone);background:var(--forest);padding:14px 28px;border-radius:2px;border:none;cursor:pointer;font-family:'Inter',sans-serif;">Comprar</button>`
2. If the page does not already load it, add before the WA FLOAT comment:
   `<script src="assets/checkout.js" defer></script>`
3. Add `"buy-cta":"Comprar",` to the ES block and `"buy-cta":"Buy now",` to
   the EN block of the page's TRANSLATIONS object.
4. Set the product's `product_url` in `biogradix_products` so the Stripe
   cancel button returns to the right page.

## Testing end-to-end (Stripe test mode, Vercel preview)

1. Push the branch — Vercel creates a preview deployment.
2. In Vercel, set the env vars for Preview using the TEST secret key.
3. Create a second Stripe webhook endpoint pointing at
   `https://<preview-url>/api/stripe-webhook`, same two events, and put its
   signing secret in the Preview `STRIPE_WEBHOOK_SECRET`.
4. On the preview URL open `/producto/recoverypro` and press Comprar.
5. Pay with test card `4242 4242 4242 4242`, any future date, any CVC, any
   Mexican postal address.
6. Verify: redirect to `/gracias.html` with the reference shown; a row in
   `biogradix_orders`; stock 120 -> 119 in `biogradix_products` plus a
   `sale` row in `biogradix_inventory_movements`; customer confirmation email;
   admin notification at hello@biogradix.com.
7. Send the same webhook event again from the Stripe dashboard: the response
   is 200 with `duplicate: true` and nothing is double-counted.

Note: the buttons call `/api/create-checkout` on the same origin, so testing
works on the preview URL directly. `gracias.html` redirects land on
`https://biogradix.com/gracias.html` (the success URL is absolute) — that page
is static, so this only matters cosmetically during preview testing.

## What happens on merge to main

Vercel deploys to production automatically. The three buy buttons are live
immediately. If the Production env vars are not set yet, `create-checkout`
returns a clean 503 and every click falls back to the existing WhatsApp flow —
no crash, no dead button. Checkout starts selling the moment
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_KEY` exist
in Production and the webhook endpoint is registered.
