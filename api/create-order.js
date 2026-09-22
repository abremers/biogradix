// POST /api/create-order
// Body: { sku, quantity (default 1), lang ('es' | 'en'),
//         customer: { name, email, phone },
//         address:  { line1, colonia, city, state, zip } }
//
// Pedido por transferencia bancaria (SPEI). Valida los datos, verifica
// disponibilidad (stock - reserved), inserta el pedido con status
// 'pending_payment', le asigna una referencia unica e impredecible (BGX-XXXXXXXX) y un
// monto exacto en MXN cuyos centavos son unicos (id % 100), y aparta el
// inventario sumando la cantidad a products.reserved. El stock NO se toca
// aqui: se descuenta cuando el panel confirma el deposito (orders.confirmPayment).
// No se inserta movimiento de inventario en esta etapa.
//
// GET /api/create-order?ref=BGX-XXXXXXXX
// Datos seguros para que pago.html pinte las instrucciones: referencia,
// estado, resumen de items, montos, tipo de cambio y los datos SPEI de las
// variables de entorno. Sin PII del cliente mas alla del primer nombre.
//
// Envs requeridas: SPEI_CLABE, SPEI_BANCO, SPEI_BENEFICIARIO, MXN_RATE.
// Si falta alguna (o SUPABASE_SERVICE_KEY) responde 503 "Checkout not yet
// enabled" y el front cae a WhatsApp.

const crypto = require('crypto');
const SUPABASE_URL = 'https://nimcmvtyamdgesmmmtyh.supabase.co';
const ADMIN_EMAIL = 'hello@biogradix.com';
const WHATSAPP_URL = 'https://wa.me/15553471798';

const VALID_SKUS = ['bpc-157', 'mots-c', 'tb-500', 'ghk-cu', 'nad-plus',
  'glutation', 'timosina-alfa-1', 'pt-141', 'cjc-1295-ipamorelin',
  'wolverine-stack', 'semax', 'dsip-melatonina'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── SUPABASE REST ────────────────────────────────────────────────────────────
function sbHeaders(serviceKey, extra) {
  return Object.assign({
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }, extra || {});
}

// ── CONFIG SPEI ──────────────────────────────────────────────────────────────
function speiEnv() {
  const clabe = (process.env.SPEI_CLABE || '').trim();
  const banco = (process.env.SPEI_BANCO || '').trim();
  const beneficiario = (process.env.SPEI_BENEFICIARIO || '').trim();
  const rate = parseFloat(process.env.MXN_RATE || '');
  if (!clabe || !banco || !beneficiario || !Number.isFinite(rate) || rate <= 0) {
    console.error('speiEnv incompleto:', JSON.stringify({
      SPEI_CLABE: clabe ? 'ok' : 'FALTA',
      SPEI_BANCO: banco ? 'ok' : 'FALTA',
      SPEI_BENEFICIARIO: beneficiario ? 'ok' : 'FALTA',
      MXN_RATE: Number.isFinite(rate) && rate > 0 ? 'ok' : 'FALTA_O_NO_NUMERICA',
    }));
    return null;
  }
  return { clabe, banco, beneficiario, rate };
}

// ── FORMATO ──────────────────────────────────────────────────────────────────
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

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function cleanText(v, max) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max || 200);
}

// ── EMAILS ───────────────────────────────────────────────────────────────────
async function sendResendEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    console.error('create-order: RESEND_API_KEY missing, skipping email');
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
    console.error('create-order: Resend error:', err);
  }
}

// Correo al cliente con las instrucciones de pago (mismo estilo de tabla que
// el correo de confirmacion del webhook de Stripe).
function buildInstructionsEmail(order, spei, isEs) {
  const t = isEs ? {
    tag: 'BIOGRADIX',
    title: 'Un paso mas: tu transferencia',
    hello: `Hola ${escapeHtml(order.first_name || '')}, tu pedido quedó reservado. Realiza la transferencia SPEI con estos datos para confirmarlo.`,
    refLabel: 'Referencia',
    amountLabel: 'Monto exacto a transferir',
    amountNote: 'Transfiere el monto exacto, centavos incluidos: así identificamos tu depósito.',
    dataTitle: 'Datos para la transferencia',
    clabe: 'CLABE',
    bank: 'Banco',
    beneficiary: 'Beneficiario',
    concept: 'Concepto / referencia',
    usdRef: 'Monto de referencia',
    rate: 'Tipo de cambio aplicado',
    stepsTitle: 'Como completar tu pago',
    step1: 'Transfiere desde tu banca en línea (SPEI) a la CLABE de arriba.',
    step2: `Escribe la referencia ${escapeHtml(order.reference)} en el concepto de la transferencia.`,
    step3: 'Te confirmamos por correo el mismo día hábil en que veamos tu depósito.',
    holdNote: 'Tu inventario queda reservado 72 horas. Si necesitas más tiempo, escríbenos.',
    summaryTitle: 'Resumen del pedido',
    product: 'Producto', qty: 'Cant.', amount: 'Importe',
    subtotal: 'Subtotal', shippingLabel: 'Envío', total: 'Total',
    waLabel: 'Enviar comprobante por WhatsApp',
    help: 'Puedes responder a este correo o mandarnos tu comprobante por WhatsApp para agilizar la confirmación.',
  } : {
    tag: 'BIOGRADIX',
    title: 'One step left: your bank transfer',
    hello: `Hi ${escapeHtml(order.first_name || '')}, your order is reserved. Make the SPEI transfer with the details below to confirm it.`,
    refLabel: 'Reference',
    amountLabel: 'Exact amount to transfer',
    amountNote: 'Transfer the exact amount, cents included: that is how we identify your deposit.',
    dataTitle: 'Transfer details',
    clabe: 'CLABE',
    bank: 'Bank',
    beneficiary: 'Beneficiary',
    concept: 'Concept / reference',
    usdRef: 'Reference amount',
    rate: 'Exchange rate applied',
    stepsTitle: 'How to complete your payment',
    step1: 'Transfer from your online banking (SPEI) to the CLABE above.',
    step2: `Write the reference ${escapeHtml(order.reference)} in the transfer concept.`,
    step3: 'We will confirm by email the same business day we see your deposit.',
    holdNote: 'Your inventory is reserved for 72 hours. If you need more time, write to us.',
    summaryTitle: 'Order summary',
    product: 'Product', qty: 'Qty', amount: 'Amount',
    subtotal: 'Subtotal', shippingLabel: 'Shipping', total: 'Total',
    waLabel: 'Send your receipt on WhatsApp',
    help: 'You can reply to this email or send us your receipt on WhatsApp to speed up confirmation.',
  };

  const rows = order.items.map((it) => `
      <tr>
        <td style="padding:12px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${escapeHtml(it.name)}</td>
        <td align="center" style="padding:12px 14px;font-size:13px;color:#4A443C;border-bottom:1px solid #EDE8E0;">${it.quantity}</td>
        <td align="right" style="padding:12px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${money(it.total, 'USD')}</td>
      </tr>`).join('');

  const dataRow = (label, value, mono) => `
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;width:42%;border-bottom:1px solid #EDE8E0;">${label}</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;${mono ? 'font-family:monospace;letter-spacing:1px;' : ''}">${value}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;overflow:hidden;">

  <tr><td style="background:#18140F;padding:28px 32px;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">${t.tag}</p>
    <h1 style="color:#F5F1EB;font-size:20px;margin:0;font-weight:400;">${t.title}</h1>
    <p style="color:#9A9189;font-size:13px;margin:6px 0 0;line-height:1.6;">${t.hello}</p>
  </td></tr>

  <tr><td style="background:#2E4A3A;padding:14px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#F5F1EB;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${t.refLabel} ${escapeHtml(order.reference)}</td>
      <td align="right" style="color:#F5F1EB;font-size:17px;font-family:monospace;">${money(order.total_mxn, 'MXN')}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 12px;">${t.dataTitle}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      ${dataRow(t.amountLabel, `<strong style="font-size:15px;">${money(order.total_mxn, 'MXN')}</strong>`, true)}
      ${dataRow(t.clabe, escapeHtml(spei.clabe), true)}
      ${dataRow(t.bank, escapeHtml(spei.banco), false)}
      ${dataRow(t.beneficiary, escapeHtml(spei.beneficiario), false)}
      ${dataRow(t.concept, escapeHtml(order.reference), true)}
      ${dataRow(t.usdRef, `${money(order.total_usd, 'USD')}`, false)}
      ${dataRow(t.rate, `${escapeHtml(String(order.mxn_rate))} MXN / USD`, false)}
    </table>
    <p style="font-size:12px;color:#4A443C;line-height:1.7;margin:10px 0 0;">${t.amountNote}</p>
  </td></tr>

  <tr><td style="padding:24px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 10px;">${t.stepsTitle}</p>
    <p style="font-size:13px;color:#18140F;line-height:1.9;margin:0;">
      1. ${t.step1}<br/>
      2. ${t.step2}<br/>
      3. ${t.step3}
    </p>
    <p style="font-size:12px;color:#4A443C;line-height:1.7;margin:14px 0 0;">${t.holdNote}</p>
  </td></tr>

  <tr><td style="padding:24px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 12px;">${t.summaryTitle}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      <tr>
        <td style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${t.product}</td>
        <td align="center" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${t.qty}</td>
        <td align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${t.amount}</td>
      </tr>${rows}
      <tr>
        <td colspan="2" style="padding:10px 14px;font-size:12px;color:#9A9189;">${t.subtotal}</td>
        <td align="right" style="padding:10px 14px;font-size:12px;color:#4A443C;">${money(order.subtotal, 'USD')}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 14px 10px;font-size:12px;color:#9A9189;">${t.shippingLabel}</td>
        <td align="right" style="padding:0 14px 10px;font-size:12px;color:#4A443C;">${money(order.shipping, 'USD')}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 14px;font-size:13px;color:#18140F;font-weight:600;border-top:1px solid #EDE8E0;">${t.total}</td>
        <td align="right" style="padding:12px 14px;font-size:13px;color:#18140F;font-weight:600;border-top:1px solid #EDE8E0;">${money(order.total_usd, 'USD')} / ${money(order.total_mxn, 'MXN')}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px 32px;">
    <p style="font-size:12px;color:#4A443C;line-height:1.7;margin:0 0 16px;">${t.help}</p>
    <a href="${WHATSAPP_URL}" style="display:inline-block;background:#2E4A3A;color:#F5F1EB;text-decoration:none;padding:12px 24px;font-family:monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;border-radius:2px;">${t.waLabel}</a>
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

// Aviso interno: pedido esperando deposito.
function buildAdminPendingEmail(order) {
  const itemsList = order.items
    .map((it) => `${it.quantity} x ${escapeHtml(it.name)} (${escapeHtml(it.sku)}) - ${money(it.total, 'USD')}`)
    .join('<br/>');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:24px auto;background:#ffffff;">
  <tr><td style="background:#18140F;padding:20px 28px;border-bottom:2px solid #8A6D1A;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 4px;">BIOGRADIX - PEDIDO POR PAGAR</p>
    <h1 style="color:#F5F1EB;font-size:17px;margin:0;font-weight:400;">${escapeHtml(order.reference)} - ${money(order.total_mxn, 'MXN')}</h1>
  </td></tr>
  <tr><td style="padding:24px 28px;">
    <p style="font-size:13px;color:#18140F;margin:0 0 4px;"><strong>${escapeHtml(order.customer_name || 'Sin nombre')}</strong></p>
    <p style="font-size:12px;color:#4A443C;margin:0 0 2px;">${escapeHtml(order.customer_email || '')}</p>
    <p style="font-size:12px;color:#4A443C;margin:0 0 16px;">${escapeHtml(order.customer_phone || '')}</p>
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">Productos</p>
    <p style="font-size:13px;color:#18140F;line-height:1.8;margin:0 0 16px;">${itemsList}</p>
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">Envio</p>
    <p style="font-size:13px;color:#4A443C;line-height:1.7;margin:0 0 16px;">${escapeHtml(order.shipping_address_text || 'Sin direccion')}</p>
    <p style="font-size:12px;color:#9A9189;line-height:1.7;margin:0;">
      Monto exacto: <strong style="color:#18140F;">${money(order.total_mxn, 'MXN')}</strong> (${money(order.total_usd, 'USD')} a ${escapeHtml(String(order.mxn_rate))})<br/>
      Referencia en el concepto: ${escapeHtml(order.reference)}<br/>
      El inventario quedo reservado. Cuando el deposito sea visible en el banco, confirma el pago desde el panel (pasa a Pagado y descuenta stock). Si no paga en 72 horas, cancela el pedido y la reserva se libera.
    </p>
  </td></tr>
  <tr><td style="background:#F5F1EB;padding:12px 28px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX - INTERNAL</p>
  </td></tr>
</table>
</body>
</html>`;
}

// ── VALIDACION ───────────────────────────────────────────────────────────────
function validatePayload(body) {
  const errors = [];
  const customer = (body && body.customer) || {};
  const address = (body && body.address) || {};

  const name = cleanText(customer.name, 120);
  const email = cleanText(customer.email, 200).toLowerCase();
  const phone = String(customer.phone == null ? '' : customer.phone).replace(/[\s\-().+]/g, '');
  const line1 = cleanText(address.line1, 200);
  const colonia = cleanText(address.colonia, 120);
  const city = cleanText(address.city, 80);
  const state = cleanText(address.state, 60);
  const zip = cleanText(address.zip, 10);

  if (name.length < 2) errors.push('name');
  if (!EMAIL_RE.test(email)) errors.push('email');
  if (!/^\d{10}$/.test(phone)) errors.push('phone');
  if (line1.length < 3) errors.push('line1');
  if (colonia.length < 2) errors.push('colonia');
  if (city.length < 2) errors.push('city');
  if (state.length < 2) errors.push('state');
  if (!/^\d{5}$/.test(zip)) errors.push('zip');

  return { errors, name, email, phone, line1, colonia, city, state, zip };
}

// ── RESERVA DE INVENTARIO ────────────────────────────────────────────────────
// reserved += qty con guardia optimista (solo escribe si reserved sigue
// siendo el leido). En carrera se reintenta una vez; si vuelve a fallar,
// el pedido no procede (409).
async function reserveInventory(serviceKey, sku, qty) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const curRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(sku)}&select=stock,reserved`,
      { headers: sbHeaders(serviceKey) }
    );
    if (!curRes.ok) return { ok: false, reason: 'db' };
    const rows = await curRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: 'missing' };
    const stock = Number(rows[0].stock || 0);
    const reserved = Number(rows[0].reserved || 0);
    if (stock - reserved < qty) return { ok: false, reason: 'stock' };

    const updRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(sku)}&reserved=eq.${reserved}`,
      {
        method: 'PATCH',
        headers: sbHeaders(serviceKey, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ reserved: reserved + qty }),
      }
    );
    if (!updRes.ok) return { ok: false, reason: 'db' };
    const updated = await updRes.json().catch(() => []);
    if (Array.isArray(updated) && updated.length > 0) return { ok: true };
    // Carrera: alguien movio reserved entre lectura y escritura. Reintentar.
  }
  return { ok: false, reason: 'race' };
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const spei = speiEnv();

  // Sin datos bancarios o sin acceso a la base: el checkout no esta habilitado.
  if (!SUPABASE_SERVICE_KEY || !spei) {
    return res.status(503).json({ error: 'Checkout not yet enabled' });
  }

  if (req.method === 'GET') return handleGet(req, res, SUPABASE_SERVICE_KEY, spei);
  return handlePost(req, res, SUPABASE_SERVICE_KEY, spei);
};

// ── GET ?ref=BGX-XXXXXXXX ────────────────────────────────────────────────────────
async function handleGet(req, res, serviceKey, spei) {
  const ref = String((req.query && req.query.ref) || '').trim().toUpperCase();
  if (!/^BGX-[A-HJ-NP-Z2-9]{8}$/.test(ref)) {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  let order;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_orders?payment_reference=eq.${encodeURIComponent(ref)}&select=payment_reference,status,customer_name,items,subtotal,shipping,total,total_mxn,mxn_rate,created_at`,
      { headers: sbHeaders(serviceKey) }
    );
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    const rows = await r.json();
    order = rows[0];
  } catch (err) {
    console.error('create-order: order lookup failed:', err);
    return res.status(502).json({ error: 'Order lookup failed' });
  }

  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Solo el primer nombre: la pagina de pago no necesita mas PII.
  const firstName = String(order.customer_name || '').trim().split(/\s+/)[0] || null;
  const items = (Array.isArray(order.items) ? order.items : []).map((it) => ({
    name: it.name || it.sku || 'Producto Biogradix',
    quantity: Number(it.quantity || it.qty || 1),
  }));

  return res.status(200).json({
    reference: order.payment_reference,
    status: order.status,
    first_name: firstName,
    items,
    subtotal: order.subtotal != null ? Number(order.subtotal) : null,
    shipping: order.shipping != null ? Number(order.shipping) : null,
    total_usd: order.total != null ? Number(order.total) : null,
    total_mxn: order.total_mxn != null ? Number(order.total_mxn) : null,
    mxn_rate: order.mxn_rate != null ? Number(order.mxn_rate) : null,
    created_at: order.created_at,
    spei: { clabe: spei.clabe, banco: spei.banco, beneficiario: spei.beneficiario },
  });
}

// ── POST ─────────────────────────────────────────────────────────────────────
async function handlePost(req, res, serviceKey, spei) {
  const body = req.body || {};
  const sku = body.sku;
  const rawQuantity = body.quantity;
  const quantity = Number.isInteger(rawQuantity) ? rawQuantity : parseInt(rawQuantity, 10) || 1;
  const isEs = body.lang !== 'en';

  if (!sku || !VALID_SKUS.includes(sku)) {
    return res.status(400).json({ error: 'Invalid sku' });
  }
  if (quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const v = validatePayload(body);
  if (v.errors.length > 0) {
    return res.status(400).json({ error: 'Invalid fields', fields: v.errors });
  }

  // ── 1. PRODUCTO ────────────────────────────────────────────────────────────
  let product;
  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?sku=eq.${encodeURIComponent(sku)}&select=sku,name,unit_label,price,currency,stock,reserved,active`,
      { headers: sbHeaders(serviceKey) }
    );
    if (!dbRes.ok) throw new Error(`Supabase ${dbRes.status}`);
    const rows = await dbRes.json();
    product = rows[0];
  } catch (err) {
    console.error('create-order: product lookup failed:', err);
    return res.status(502).json({ error: 'Catalog unavailable' });
  }

  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!product.active) return res.status(409).json({ error: 'Product not available' });
  const available = Number(product.stock || 0) - Number(product.reserved || 0);
  if (available < quantity) return res.status(409).json({ error: 'Out of stock' });

  // ── 2. MONTOS ──────────────────────────────────────────────────────────────
  const unitPrice = round2(parseFloat(product.price));
  const subtotal = round2(unitPrice * quantity);
  const shipping = round2(parseFloat(process.env.SHIPPING_USD || '10.00'));
  const totalUsd = round2(subtotal + shipping);

  const unitLabel = isEs ? (product.unit_label || 'Pack de 20 parches') : 'Pack of 20 patches';
  const itemName = `${product.name} - ${unitLabel}`;
  const items = [{
    sku: product.sku,
    name: itemName,
    quantity,
    unit_price: unitPrice,
    total: subtotal,
  }];

  // ── 3. INSERTAR PEDIDO (pending_payment) ───────────────────────────────────
  // La referencia y el monto MXN dependen del id, asi que primero se inserta
  // la fila y despues se completa con el id devuelto.
  const orderRow = {
    customer_name: v.name,
    customer_email: v.email,
    customer_phone: v.phone,
    shipping_address: {
      name: v.name,
      line1: v.line1,
      line2: v.colonia,
      city: v.city,
      state: v.state,
      postal_code: v.zip,
      country: 'MX',
    },
    items,
    subtotal,
    shipping,
    total: totalUsd,
    currency: 'USD',
    payment_provider: 'spei',
    payment_id: null,
    status: 'pending_payment',
    source: 'biogradix.com',
    utm: { lang: isEs ? 'es' : 'en' },
    mxn_rate: spei.rate,
  };

  let orderId;
  try {
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/biogradix_orders`, {
      method: 'POST',
      headers: sbHeaders(serviceKey, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(orderRow),
    });
    if (!insRes.ok) {
      const errBody = await insRes.text().catch(() => '');
      console.error('create-order: order insert failed:', insRes.status, errBody);
      return res.status(502).json({ error: 'Could not create order' });
    }
    const inserted = await insRes.json();
    orderId = inserted[0] && inserted[0].id;
    if (orderId == null) throw new Error('insert returned no id');
  } catch (err) {
    console.error('create-order: order insert failed:', err);
    return res.status(502).json({ error: 'Could not create order' });
  }

  // Limpieza best effort si un paso posterior falla: el pedido nunca llego a
  // mostrarse al cliente, asi que se elimina en lugar de dejar basura pendiente.
  async function discardOrder() {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/biogradix_orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
        headers: sbHeaders(serviceKey, { 'Prefer': 'return=minimal' }),
      });
    } catch (err) {
      console.error('create-order: could not discard order', orderId, err);
    }
  }

  // ── 4. REFERENCIA + MONTO MXN EXACTO ───────────────────────────────────────
  // Referencia legible y monto con centavos unicos (id % 100) para casar el
  // deposito en el banco con el pedido.
  const idNum = Number(orderId);
  const totalMxn = round2(Math.floor(totalUsd * spei.rate) + (idNum % 100) / 100);

  // Referencia impredecible: es a la vez el concepto bancario y la llave de
  // consulta de pago.html, asi que no puede ser secuencial (enumerable).
  // Alfabeto sin caracteres ambiguos (sin 0/O/1/I/L), 8 chars = ~39 bits.
  const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const makeReference = () => {
    const bytes = crypto.randomBytes(8);
    let out = '';
    for (let i = 0; i < 8; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
    return 'BGX-' + out;
  };

  let reference = null;
  for (let attempt = 0; attempt < 3 && !reference; attempt++) {
    const candidate = makeReference();
    try {
      const updRes = await fetch(`${SUPABASE_URL}/rest/v1/biogradix_orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: sbHeaders(serviceKey, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ payment_reference: candidate, total_mxn: totalMxn }),
      });
      if (updRes.status === 409) continue; // colision UNIQUE: reintentar con otra
      if (!updRes.ok) throw new Error(`Supabase ${updRes.status}`);
      const updated = await updRes.json();
      if (!Array.isArray(updated) || updated.length === 0) throw new Error('reference update matched no rows');
      reference = candidate;
    } catch (err) {
      console.error('create-order: reference update failed:', err);
      await discardOrder();
      return res.status(502).json({ error: 'Could not create order' });
    }
  }
  if (!reference) {
    await discardOrder();
    return res.status(502).json({ error: 'Could not create order' });
  }

  // ── 5. RESERVAR INVENTARIO ─────────────────────────────────────────────────
  // Sin movimiento de inventario: el stock no se mueve hasta confirmar el pago.
  const reservation = await reserveInventory(serviceKey, product.sku, quantity);
  if (!reservation.ok) {
    await discardOrder();
    if (reservation.reason === 'stock' || reservation.reason === 'race') {
      return res.status(409).json({ error: 'Out of stock' });
    }
    return res.status(502).json({ error: 'Could not create order' });
  }

  // ── 6. CORREOS (best effort) ───────────────────────────────────────────────
  const emailOrder = {
    reference,
    first_name: v.name.split(/\s+/)[0] || '',
    customer_name: v.name,
    customer_email: v.email,
    customer_phone: v.phone,
    items,
    subtotal,
    shipping,
    total_usd: totalUsd,
    total_mxn: totalMxn,
    mxn_rate: spei.rate,
    shipping_address_text: `${v.line1}, ${v.colonia}, ${v.zip} ${v.city}, ${v.state}, MX`,
  };

  try {
    await sendResendEmail({
      from: 'Biogradix <protocolos@biogradix.com>',
      to: [v.email],
      subject: isEs
        ? `Completa tu pago — Pedido ${reference} — Biogradix`
        : `Complete your payment — Order ${reference} — Biogradix`,
      html: buildInstructionsEmail(emailOrder, spei, isEs),
    });
    await sendResendEmail({
      from: 'Biogradix Pedidos <protocolos@biogradix.com>',
      to: [ADMIN_EMAIL],
      subject: `Pedido por pagar ${reference} — ${money(totalMxn, 'MXN')}`,
      html: buildAdminPendingEmail(emailOrder),
    });
  } catch (err) {
    console.error('create-order: email sending failed (non-fatal):', err);
  }

  return res.status(200).json({
    reference,
    total_mxn: totalMxn,
    total_usd: totalUsd,
  });
}
