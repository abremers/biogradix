// POST /api/stripe-webhook
// Receives Stripe webhook events. Verifies the stripe-signature header
// manually (HMAC SHA-256 over `${timestamp}.${rawBody}`), then on a paid
// checkout session: inserts the order, decrements stock, emails the customer
// and the admin, and fires a TikTok CompletePayment event when configured.
//
// Handles both checkout.session.completed (cards pay synchronously) and
// checkout.session.async_payment_succeeded (OXXO, offered only on MXN
// products, pays hours/days later). Orders are only recorded once
// payment_status is 'paid'. Amounts are stored in the session currency
// (launch: USD) with the currency recorded on the order row.

const crypto = require('crypto');

const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const ADMIN_EMAIL = 'hello@biogradix.com';
const SIGNATURE_TOLERANCE_SEC = 300;

// ── RAW BODY (bodyParser disabled below) ─────────────────────────────────────
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ── SIGNATURE VERIFICATION ───────────────────────────────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || typeof sigHeader !== 'string') return false;

  let timestamp = null;
  const v1Signatures = [];
  for (const part of sigHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1') v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > SIGNATURE_TOLERANCE_SEC) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  return v1Signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch (err) {
      return false;
    }
  });
}

// ── SUPABASE REST HELPERS ────────────────────────────────────────────────────
function sbHeaders(serviceKey, extra) {
  return Object.assign({
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }, extra || {});
}

// ── MONEY FORMAT ─────────────────────────────────────────────────────────────
function money(n, currency) {
  const fixed = Number(n || 0).toFixed(2);
  const grouped = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${grouped} ${(currency || 'USD').toUpperCase()}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatAddress(addr) {
  if (!addr) return '';
  const parts = [
    addr.line1, addr.line2,
    [addr.postal_code, addr.city].filter(Boolean).join(' '),
    addr.state, addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

// ── EMAILS ───────────────────────────────────────────────────────────────────
function buildCustomerEmail(order, isEs) {
  const cur = order.currency;
  const rows = order.items.map((it) => `
      <tr>
        <td style="padding:12px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${escapeHtml(it.name)}</td>
        <td align="center" style="padding:12px 14px;font-size:13px;color:#4A443C;border-bottom:1px solid #EDE8E0;">${it.quantity}</td>
        <td align="right" style="padding:12px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${money(it.total, cur)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;overflow:hidden;">

  <tr><td style="background:#18140F;padding:28px 32px;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">BIOGRADIX</p>
    <h1 style="color:#F5F1EB;font-size:20px;margin:0;font-weight:400;">${isEs ? 'Pedido confirmado' : 'Order confirmed'}</h1>
    <p style="color:#9A9189;font-size:13px;margin:6px 0 0;">${isEs
      ? `Gracias, ${escapeHtml(order.customer_name || '')}. Tu pedido esta en preparacion.`
      : `Thank you, ${escapeHtml(order.customer_name || '')}. Your order is being prepared.`}</p>
  </td></tr>

  <tr><td style="background:#2E4A3A;padding:12px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#F5F1EB;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${isEs ? 'Pedido' : 'Order'} #${order.id}</td>
      <td align="right" style="color:#F5F1EB;font-size:16px;font-family:monospace;">${money(order.total, cur)}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 12px;">${isEs ? 'Resumen' : 'Summary'}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      <tr>
        <td style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${isEs ? 'Producto' : 'Product'}</td>
        <td align="center" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${isEs ? 'Cant.' : 'Qty'}</td>
        <td align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${isEs ? 'Importe' : 'Amount'}</td>
      </tr>${rows}
      <tr>
        <td colspan="2" style="padding:10px 14px;font-size:12px;color:#9A9189;">${isEs ? 'Subtotal' : 'Subtotal'}</td>
        <td align="right" style="padding:10px 14px;font-size:12px;color:#4A443C;">${money(order.subtotal, cur)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 14px 10px;font-size:12px;color:#9A9189;">${isEs ? 'Envio' : 'Shipping'}</td>
        <td align="right" style="padding:0 14px 10px;font-size:12px;color:#4A443C;">${Number(order.shipping) === 0 ? (isEs ? 'Gratis' : 'Free') : money(order.shipping, cur)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 14px;font-size:13px;color:#18140F;font-weight:600;border-top:1px solid #EDE8E0;">Total</td>
        <td align="right" style="padding:12px 14px;font-size:13px;color:#18140F;font-weight:600;border-top:1px solid #EDE8E0;">${money(order.total, cur)}</td>
      </tr>
    </table>
  </td></tr>

  ${order.shipping_address_text ? `
  <tr><td style="padding:24px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 8px;">${isEs ? 'Direccion de envio' : 'Shipping address'}</p>
    <p style="font-size:13px;color:#4A443C;line-height:1.7;margin:0;">${escapeHtml(order.shipping_address_text)}</p>
  </td></tr>` : ''}

  <tr><td style="padding:24px 32px 0;">
    <p style="font-size:13px;color:#4A443C;line-height:1.8;margin:0;">${isEs
      ? 'Te avisaremos por este medio cuando tu pedido sea enviado, junto con tu numero de guia. Si tienes cualquier duda, responde a este correo o escribenos por WhatsApp.'
      : 'We will email you again when your order ships, along with your tracking number. If you have any questions, reply to this email or reach us on WhatsApp.'}</p>
  </td></tr>

  <tr><td style="padding:24px 32px 32px;">
    <a href="https://wa.me/15553471798" style="display:inline-block;background:#2E4A3A;color:#F5F1EB;text-decoration:none;padding:12px 24px;font-family:monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;border-radius:2px;">WhatsApp</a>
  </td></tr>

  <tr><td style="background:#F5F1EB;padding:14px 32px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX - biogradix.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildAdminEmail(order) {
  const cur = order.currency;
  const itemsList = order.items
    .map((it) => `${it.quantity} x ${escapeHtml(it.name)} (${escapeHtml(it.sku)}) - ${money(it.total, cur)}`)
    .join('<br/>');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:24px auto;background:#ffffff;">
  <tr><td style="background:#18140F;padding:20px 28px;border-bottom:2px solid #2E4A3A;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 4px;">BIOGRADIX - NUEVO PEDIDO</p>
    <h1 style="color:#F5F1EB;font-size:17px;margin:0;font-weight:400;">Pedido #${order.id} - ${money(order.total, cur)}</h1>
  </td></tr>
  <tr><td style="padding:24px 28px;">
    <p style="font-size:13px;color:#18140F;margin:0 0 4px;"><strong>${escapeHtml(order.customer_name || 'Sin nombre')}</strong></p>
    <p style="font-size:12px;color:#4A443C;margin:0 0 2px;">${escapeHtml(order.customer_email || '')}</p>
    <p style="font-size:12px;color:#4A443C;margin:0 0 16px;">${escapeHtml(order.customer_phone || '')}</p>
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">Productos</p>
    <p style="font-size:13px;color:#18140F;line-height:1.8;margin:0 0 16px;">${itemsList}</p>
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">Envio</p>
    <p style="font-size:13px;color:#4A443C;line-height:1.7;margin:0 0 16px;">${escapeHtml(order.shipping_address_text || 'Sin direccion')}</p>
    <p style="font-size:12px;color:#9A9189;margin:0;">Subtotal ${money(order.subtotal, cur)} - Envio ${money(order.shipping, cur)} - Stripe: ${escapeHtml(order.stripe_session_id)}</p>
  </td></tr>
  <tr><td style="background:#F5F1EB;padding:12px 28px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX - INTERNAL</p>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendResendEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    console.error('stripe-webhook: RESEND_API_KEY missing, skipping email');
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    console.error('stripe-webhook: Resend error:', err);
  }
}

// ── TIKTOK EVENTS API ────────────────────────────────────────────────────────
async function sendTikTokEvent(order) {
  const pixelId = process.env.TIKTOK_PIXEL_ID;
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    const hashedEmail = order.customer_email
      ? crypto.createHash('sha256').update(order.customer_email.trim().toLowerCase()).digest('hex')
      : undefined;

    await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/track/', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pixel_code: pixelId,
        event: 'CompletePayment',
        event_id: order.stripe_session_id,
        timestamp: new Date().toISOString(),
        context: {
          user: hashedEmail ? { email: hashedEmail } : {},
          page: { url: 'https://biogradix.com' },
        },
        properties: {
          currency: (order.currency || 'USD').toUpperCase(),
          value: Number(order.total),
          content_type: 'product',
          contents: order.items.map((it) => ({
            content_id: it.sku,
            content_name: it.name,
            quantity: it.quantity,
            price: Number(it.unit_price),
          })),
        },
      }),
    });
  } catch (err) {
    console.error('stripe-webhook: TikTok event failed (non-fatal):', err);
  }
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Checkout not yet enabled' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('stripe-webhook: could not read body:', err);
    return res.status(400).json({ error: 'Invalid body' });
  }

  if (!verifyStripeSignature(rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)) {
    console.error('stripe-webhook: signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Cards complete synchronously (completed, payment_status=paid).
  // OXXO (MXN only) completes the session first, then pays later
  // (async_payment_succeeded).
  const relevant = event.type === 'checkout.session.completed'
    || event.type === 'checkout.session.async_payment_succeeded';
  if (!relevant) return res.status(200).json({ received: true });

  const session = event.data && event.data.object;
  if (!session || session.payment_status !== 'paid') {
    // Async payment (e.g. OXXO voucher issued, not yet paid): wait for
    // async_payment_succeeded.
    return res.status(200).json({ received: true, pending: true });
  }

  const sessionCurrency = (session.currency || 'usd').toUpperCase();

  try {
    // ── 1. IDEMPOTENCY ─────────────────────────────────────────────────────
    const dupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_orders?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=id`,
      { headers: sbHeaders(SUPABASE_SERVICE_KEY) }
    );
    const dupRows = dupRes.ok ? await dupRes.json() : [];
    if (dupRows.length > 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // ── 2. LINE ITEMS ──────────────────────────────────────────────────────
    let items = [];
    try {
      const liRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/line_items?limit=100&expand[]=data.price.product`,
        { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
      );
      const liJson = await liRes.json();
      if (liRes.ok && Array.isArray(liJson.data)) {
        items = liJson.data.map((li) => {
          const productMeta = li.price && li.price.product && li.price.product.metadata;
          return {
            sku: (productMeta && productMeta.sku) || (session.metadata && session.metadata.sku) || 'unknown',
            name: li.description || 'Producto Biogradix',
            quantity: li.quantity || 1,
            unit_price: li.price ? li.price.unit_amount / 100 : 0,
            total: (li.amount_total != null ? li.amount_total : 0) / 100,
          };
        });
      }
    } catch (err) {
      console.error('stripe-webhook: line items fetch failed:', err);
    }
    if (items.length === 0 && session.metadata && session.metadata.sku) {
      // Fallback: reconstruct from session metadata
      const qty = parseInt(session.metadata.quantity, 10) || 1;
      items = [{
        sku: session.metadata.sku,
        name: session.metadata.sku,
        quantity: qty,
        unit_price: (session.amount_subtotal || 0) / 100 / qty,
        total: (session.amount_subtotal || 0) / 100,
      }];
    }

    // ── 3. CUSTOMER + SHIPPING DETAILS ─────────────────────────────────────
    const cd = session.customer_details || {};
    const shipping = session.shipping_details
      || (session.collected_information && session.collected_information.shipping_details)
      || null;
    const shippingAddress = shipping
      ? { name: shipping.name || cd.name || null, ...(shipping.address || {}) }
      : (cd.address ? { name: cd.name || null, ...cd.address } : null);

    const utm = {};
    if (session.metadata) {
      for (const [k, v] of Object.entries(session.metadata)) {
        if (k.startsWith('utm_')) utm[k] = v;
      }
    }

    const orderRow = {
      customer_name: (shipping && shipping.name) || cd.name || null,
      customer_email: cd.email || null,
      customer_phone: cd.phone || null,
      shipping_address: shippingAddress,
      items: items,
      subtotal: (session.amount_subtotal || 0) / 100,
      shipping: ((session.total_details && session.total_details.amount_shipping) || 0) / 100,
      total: (session.amount_total || 0) / 100,
      currency: sessionCurrency,
      payment_provider: 'stripe',
      payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripe_session_id: session.id,
      status: 'paid',
      source: (session.metadata && session.metadata.source) || 'web',
      utm: Object.keys(utm).length > 0 ? utm : null,
    };

    // ── 4. INSERT ORDER ────────────────────────────────────────────────────
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/biogradix_orders`, {
      method: 'POST',
      headers: sbHeaders(SUPABASE_SERVICE_KEY, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(orderRow),
    });
    if (!insRes.ok) {
      const errBody = await insRes.text().catch(() => '');
      // Unique violation on stripe_session_id = concurrent duplicate: fine.
      if (insRes.status === 409 || errBody.includes('duplicate key')) {
        return res.status(200).json({ received: true, duplicate: true });
      }
      console.error('stripe-webhook: order insert failed:', insRes.status, errBody);
      // Non-200 so Stripe retries; the idempotency check makes retries safe.
      return res.status(500).json({ error: 'Order persistence failed' });
    }
    const inserted = await insRes.json();
    const orderId = inserted[0] && inserted[0].id;

    // ── 5. DECREMENT STOCK + MOVEMENTS (best effort) ───────────────────────
    for (const it of items) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/biogradix_inventory_movements`, {
          method: 'POST',
          headers: sbHeaders(SUPABASE_SERVICE_KEY, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({
            sku: it.sku,
            delta: -Math.abs(it.quantity),
            reason: 'sale',
            order_id: orderId || null,
            note: `Stripe ${session.id}`,
          }),
        });

        const prodRes = await fetch(
          `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(it.sku)}&select=stock`,
          { headers: sbHeaders(SUPABASE_SERVICE_KEY) }
        );
        const prodRows = prodRes.ok ? await prodRes.json() : [];
        if (prodRows[0]) {
          await fetch(`${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(it.sku)}`, {
            method: 'PATCH',
            headers: sbHeaders(SUPABASE_SERVICE_KEY, { 'Prefer': 'return=minimal' }),
            body: JSON.stringify({ stock: prodRows[0].stock - Math.abs(it.quantity) }),
          });
        }
      } catch (err) {
        console.error(`stripe-webhook: stock update failed for ${it.sku}:`, err);
      }
    }

    // ── 6. EMAILS + TIKTOK (best effort) ───────────────────────────────────
    const isEs = ((session.metadata && session.metadata.lang) || session.locale || 'es') !== 'en';
    const emailOrder = {
      id: orderId || '-',
      customer_name: orderRow.customer_name,
      customer_email: orderRow.customer_email,
      customer_phone: orderRow.customer_phone,
      items,
      subtotal: orderRow.subtotal,
      shipping: orderRow.shipping,
      total: orderRow.total,
      currency: sessionCurrency,
      stripe_session_id: session.id,
      shipping_address_text: formatAddress(shippingAddress),
    };

    try {
      if (emailOrder.customer_email) {
        await sendResendEmail({
          from: 'Biogradix <protocolos@biogradix.com>',
          to: [emailOrder.customer_email],
          subject: isEs
            ? `Pedido confirmado #${emailOrder.id} — Biogradix`
            : `Order confirmed #${emailOrder.id} — Biogradix`,
          html: buildCustomerEmail(emailOrder, isEs),
        });
      }
      await sendResendEmail({
        from: 'Biogradix Pedidos <protocolos@biogradix.com>',
        to: [ADMIN_EMAIL],
        subject: `Nuevo pedido #${emailOrder.id} — ${money(emailOrder.total, sessionCurrency)}`,
        html: buildAdminEmail(emailOrder),
      });
    } catch (err) {
      console.error('stripe-webhook: email sending failed (non-fatal):', err);
    }

    await sendTikTokEvent(emailOrder);

    return res.status(200).json({ received: true, order_id: orderId });
  } catch (err) {
    console.error('stripe-webhook: unexpected error:', err);
    // Order state unknown: let Stripe retry (idempotency check protects us).
    return res.status(500).json({ error: 'Internal error' });
  }
};

// Raw body needed for signature verification.
module.exports.config = { api: { bodyParser: false } };
