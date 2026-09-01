// POST /api/create-checkout
// Body: { sku, quantity (default 1), lang ('es' | 'en') }
// Looks up the product in Supabase, validates stock, creates a Stripe
// Checkout Session via raw fetch (no npm dependency) and returns { url }.
//
// Currency comes from the product row (launch: USD). OXXO is only offered
// when the product currency is MXN (Stripe constraint), so switching a
// product to MXN later is a data change, not a code change.

const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const SITE_URL = 'https://biogradix.com';

const VALID_SKUS = ['bpc-157', 'mots-c', 'tb-500', 'ghk-cu', 'nad-plus'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // Stripe account / service key not configured yet: fail cleanly, never crash.
  if (!STRIPE_SECRET_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Checkout not yet enabled' });
  }

  const { sku, quantity: rawQuantity, lang } = req.body || {};
  const quantity = Number.isInteger(rawQuantity) ? rawQuantity : parseInt(rawQuantity, 10) || 1;
  const isEs = lang !== 'en';

  if (!sku || !VALID_SKUS.includes(sku)) {
    return res.status(400).json({ error: 'Invalid sku' });
  }
  if (quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  // ── 1. LOOK UP PRODUCT ──────────────────────────────────────────────────
  let product;
  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(sku)}&select=sku,name,unit_label,price,currency,stock,active,product_url`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (!dbRes.ok) throw new Error(`Supabase ${dbRes.status}`);
    const rows = await dbRes.json();
    product = rows[0];
  } catch (err) {
    console.error('create-checkout: product lookup failed:', err);
    return res.status(502).json({ error: 'Catalog unavailable' });
  }

  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!product.active) return res.status(409).json({ error: 'Product not available' });
  if (product.stock < quantity) return res.status(409).json({ error: 'Out of stock' });

  // ── 2. PRICING & SHIPPING ───────────────────────────────────────────────
  const currency = (product.currency || 'USD').toLowerCase(); // 'usd' | 'mxn'
  const unitAmount = Math.round(parseFloat(product.price) * 100); // minor units
  const subtotal = (unitAmount * quantity) / 100;

  // Flat shipping within Mexico, denominated in the product currency.
  const flatShipping = currency === 'mxn'
    ? parseFloat(process.env.SHIPPING_MXN || '149.00')
    : parseFloat(process.env.SHIPPING_USD || '10.00');

  // Free-shipping hook: OFF by default for launch. Set FREE_SHIPPING_THRESHOLD
  // (in the product currency) to a positive number to enable it later.
  const freeThreshold = parseFloat(process.env.FREE_SHIPPING_THRESHOLD || '0');
  const freeShipping = freeThreshold > 0 && subtotal >= freeThreshold;

  const shippingAmount = freeShipping ? 0 : Math.round(flatShipping * 100);
  const shippingLabel = freeShipping
    ? (isEs ? 'Envio gratis' : 'Free shipping')
    : (isEs ? 'Envio estandar (Mexico)' : 'Standard shipping (Mexico)');

  const cancelPath = product.product_url || '/';
  const unitLabel = isEs ? (product.unit_label || 'Pack de 20 parches') : 'Pack of 20 patches';
  const lineItemName = `${product.name} - ${unitLabel}`;

  // ── 3. CREATE STRIPE CHECKOUT SESSION (raw REST, form-encoded) ──────────
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[0]', 'card');
  if (currency === 'mxn') {
    // OXXO only supports MXN payments.
    params.append('payment_method_types[1]', 'oxxo');
  }
  params.append('line_items[0][quantity]', String(quantity));
  params.append('line_items[0][price_data][currency]', currency);
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.append('line_items[0][price_data][product_data][name]', lineItemName);
  params.append('line_items[0][price_data][product_data][metadata][sku]', product.sku);
  params.append('shipping_address_collection[allowed_countries][0]', 'MX');
  params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[0][shipping_rate_data][display_name]', shippingLabel);
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(shippingAmount));
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', currency);
  params.append('phone_number_collection[enabled]', 'true');
  params.append('locale', isEs ? 'es' : 'en');
  params.append('metadata[sku]', product.sku);
  params.append('metadata[quantity]', String(quantity));
  params.append('metadata[lang]', isEs ? 'es' : 'en');
  params.append('metadata[source]', 'biogradix.com');
  params.append('success_url', `${SITE_URL}/gracias.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${SITE_URL}${cancelPath}`);

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok || !session.url) {
      console.error('create-checkout: Stripe error:', session.error || session);
      return res.status(502).json({ error: 'Could not create checkout session' });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout: Stripe request failed:', err);
    return res.status(502).json({ error: 'Could not create checkout session' });
  }
};
