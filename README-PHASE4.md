# Phase 4 — SPEI Bank-Transfer Checkout

Replaces the dead Stripe card flow (Stripe closed the account) with a manual
SPEI bank-transfer checkout. The buy buttons now lead to an on-site order form
(`/checkout`); the customer gets a unique reference and the exact MXN amount to
transfer (`/pago`), and you confirm each deposit by hand from the admin panel.
Nothing goes live until the env vars below exist; without them
`/api/create-order` answers 503 and both the checkout page and the buy-button
helper fall back to WhatsApp, so deploying is safe at any time.

## Files

| File | Purpose |
|---|---|
| `sql/phase4-spei.sql` | DB migration: adds the `pending_payment` status plus `payment_reference`, `total_mxn`, `mxn_rate`, `expires_note` columns to `biogradix_orders`. Paste it in Supabase > SQL Editor BEFORE setting the env vars. Idempotent. |
| `api/create-order.js` | POST: validates the form, checks availability (stock - reserved), inserts the order as `pending_payment`, assigns an unguessable `BGX-XXXXXXXX` reference (random, non-enumerable) and the exact MXN amount, reserves inventory, emails customer + admin. GET `?ref=BGX-XXXXXXXX` (the random reference is the lookup capability): safe data for `pago.html` (no PII beyond the first name). |
| `checkout.html` | Order form (`/checkout?sku=...&qty=...`). Client-side validation, bilingual ES/EN, server revalidates everything. |
| `pago.html` | Payment instructions (`/pago?ref=BGX-XXXXXXXX`): reference, exact MXN amount, CLABE with copy buttons, steps, 72-hour note. |
| `api/admin.js` | New action `orders.confirmPayment`; cancelling a `pending_payment` order now releases the reservation; restock is blocked for never-paid SPEI orders. |
| `admin.html` | "Por pagar" status chip (amber), "Confirmar pago" button with confirm dialog, reference and MXN subtexts in the orders table. |
| `assets/checkout.js` | Buy buttons now navigate to `/checkout?sku=<sku>` (WhatsApp only if a button has no sku). Product pages need no edits. |

`vercel.json` needed no changes: `cleanUrls: true` already serves
`checkout.html` at `/checkout` and `pago.html` at `/pago`, the same way
`/gracias` works today.

## SQL to run (once, before enabling)

Paste `sql/phase4-spei.sql` into Supabase > SQL Editor and run it. The final
SELECTs must show the new check constraint (with `pending_payment`) and the 4
new columns. Until this runs, creating an order fails with a DB error, so run
it before setting the env vars.

## Environment variables (Vercel, Production + Preview)

All four are required; if any is missing, `/api/create-order` answers
`503 { error: 'Checkout not yet enabled' }` and the site falls back to WhatsApp.

| Var | Example | Notes |
|---|---|---|
| `SPEI_CLABE` | `012180001234567895` | 18-digit CLABE customers transfer to. Shown on `/pago` and in the instructions email. |
| `SPEI_BANCO` | `BBVA` | Bank name, display only. |
| `SPEI_BENEFICIARIO` | `Alejandro Bremer` | Account holder name exactly as the bank shows it. |
| `MXN_RATE` | `18.70` | USD to MXN rate applied at order creation. Update it manually when the market moves; each order freezes the rate it was created with (`mxn_rate` column). |

Already configured and reused: `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`,
`SHIPPING_USD` (defaults to `10.00`).

## Money flow (reserva -> deposito -> confirmar pago)

1. **Reserva.** Customer submits `/checkout`. The order is inserted as
   `pending_payment` with random reference `BGX-XXXXXXXX` (not sequential, so order data cannot be enumerated) and
   `total_mxn = floor(total_usd * MXN_RATE) + (id % 100) / 100` — whole pesos
   plus unique centavos, so each deposit identifies its order even if the
   customer forgets the reference. The quantity is added to
   `biogradix_products.reserved`; stock does not move and no inventory
   movement is written. The public site already treats availability as
   `stock - reserved`, so the pack is held automatically.
2. **Deposito.** The customer transfers the exact MXN amount with the
   reference in the concept. You see it land in the bank (they can also send
   the receipt via WhatsApp).
3. **Confirmar pago.** In the panel (Pedidos tab) the order shows the amber
   "Por pagar" chip with a "Confirmar pago" button. It asks for confirmation
   (reference + amount), then: stock and reserved go down together, a `sale`
   movement is written (note "SPEI confirmado"), the order becomes `paid`
   (`payment_id = 'spei-manual'`), and the customer gets the confirmation
   email. From `paid` on, the order follows the same flow as before
   (Preparar, Enviar, Entregado).

Inventory is adjusted BEFORE the status changes, so a race can never leave a
paid order without its stock deducted; if the inventory write fails you get a
409 and the order stays "Por pagar".

## 72-hour expiry (manual for now)

The reservation convention is 72 hours; the customer sees it on `/pago` and in
the instructions email. There is no automatic expiry yet: check the Pedidos
tab filtered by "Por pagar" and cancel anything older than 72 hours (or that
the customer abandoned). Cancelling a pending order automatically releases its
reservation (`reserved -= qty`), returning the pack to the available count. No
inventory movement is written because stock never moved. The "Reponer
inventario" button is intentionally blocked for these orders — their packs
never left the stock.

If a customer pays after you cancelled, create nothing by hand: ask them to
order again (new reference) or refund the transfer.

## Emails

| Email | To | When | Contents |
|---|---|---|---|
| Payment instructions | Customer (ES or EN by page language) | Order created | Reference, exact MXN amount, CLABE / bank / beneficiary, USD reference amount and rate, 3 steps, 72-hour note, order summary, WhatsApp button for the receipt. |
| Pending-order alert | `hello@biogradix.com` | Order created | Subject "Pedido por pagar BGX-xxxx — $X MXN": customer contact, items, exact amount, reminder of the confirm/cancel flow. |
| Payment confirmed | Customer (bcc hello@) | You press "Confirmar pago" | House order-confirmation template: payment line (SPEI + reference + MXN), items table, totals, shipping address, "we will email your tracking number". |

All from `Biogradix <protocolos@biogradix.com>` via Resend, house table style,
no emojis.

## Deferred / known limits

- No automatic 72-hour expiry job (manual cancel from the panel for now).
- No partial-payment handling: if the transferred amount does not match,
  resolve it by WhatsApp before confirming.
- `expires_note` column exists for future use; nothing writes it yet.
- Quantity on `/checkout` comes from the URL (`&qty=`, capped at 10); the page
  does not include a quantity picker.
