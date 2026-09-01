// POST /api/create-checkout
// Body: { sku, quantity (default 1), lang ('es' | 'en') }
// Looks up the product in Supabase, validates stock, creates a Stripe
// Checkout Session via raw fetch (no npm dependency) and returns { url }.

const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const SITE_URL = 'https://biogradix.com';

const VALID_SKUS = ['celldew', 'immunefort', 'musclemaxx', 'passionboost', 'radiancemax', 'recoverypro', 'vitacharge'];

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
      `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(sku)}&select=sku,name,peptide,price_mxn,stock,active,product_url`,
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
  const unitAmount = Math.round(parseFloat(product.price_mxn) * 100); // centavos
  const subtotalMxn = (unitAmount * quantity) / 100;

  const shippingMxn = parseFloat(process.env.SHIPPING_MXN || '149.00');
  const freeThresholdMxn = parseFloat(process.env.FREE_SHIPPING_THRESHOLD_MXN || '1500');
  const freeShipping = subtotalMxn >= freeThresholdMxn;
  const shippingAmount = freeShipping ? 0 : Math.round(shippingMxn * 100);
  const shippingLabel = freeShipping
    ? (isEs ? 'Envio gratis' : 'Free shipping')
    : (isEs ? 'Envio estandar' : 'Standard shipping');

  const cancelPath = product.product_url || `/producto/${sku}`;

  // ── 3. CREATE STRIPE CHECKOUT SESSION (raw REST, form-encoded) ──────────
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[0]', 'card');
  params.append('payment_method_types[1]', 'oxxo');
  params.append('line_items[0][quantity]', String(quantity));
  params.append('line_items[0][price_data][currency]', 'mxn');
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.append('line_items[0][price_data][product_data][name]', product.peptide ? `${product.name} (${product.peptide})` : product.name);
  params.append('line_items[0][price_data][product_data][metadata][sku]', product.sku);
  params.append('shipping_address_collection[allowed_countries][0]', 'MX');
  params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[0][shipping_rate_data][display_name]', shippingLabel);
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(shippingAmount));
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'mxn');
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
