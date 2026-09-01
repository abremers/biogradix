// api/admin.js — Endpoint unico del panel de operaciones (admin.html).
// Router por "action" (query param o campo del body JSON).
// Auth: Authorization: Bearer <ADMIN_SECRET> con comparacion de tiempo constante.
// Acceso a Supabase via REST con la service key (env SUPABASE_SERVICE_KEY).

const crypto = require('crypto');

const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const ADMIN_EMAIL = 'hello@biogradix.com';

const ORDER_STATUSES = ['paid', 'preparing', 'shipped', 'delivered', 'refunded', 'cancelled'];
const ADJUST_REASONS = ['restock', 'sample', 'damage', 'adjustment'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeEqual(a, b) {
  // Hash de ambos lados: la comparacion es de tiempo constante e
  // independiente de la longitud de las cadenas.
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Llamada generica a PostgREST. Devuelve { ok, status, data }.
// Si la tabla no existe todavia (Fase 1 pendiente), lo marca como missing_table.
async function sb(path, options) {
  const opts = options || {};
  const headers = Object.assign({
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }, opts.headers || {});

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data = null;
  const text = await r.text();
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  }

  if (!r.ok) {
    const code = data && data.code;
    if (code === '42P01' || code === 'PGRST205') {
      return { ok: false, status: 424, missingTable: true, data };
    }
  }
  return { ok: r.ok, status: r.status, data };
}

function tableError(res, table) {
  return sendError(res, 424, 'missing_table',
    `La tabla ${table} no existe todavía en Supabase. Ejecuta primero el SQL de la Fase 1.`);
}

function dbError(res, result) {
  const msg = result.data && (result.data.message || result.data.hint || result.data.raw);
  return sendError(res, 502, 'db_error', `Error de base de datos (${result.status}): ${msg || 'sin detalle'}`);
}

// Idioma del pedido: utm.lang / utm.language si existen, o "en" en source; si no, espanol.
function orderIsSpanish(order) {
  let lang = null;
  const utm = order && order.utm;
  if (utm && typeof utm === 'object') lang = utm.lang || utm.language || null;
  if (!lang && typeof (order && order.source) === 'string') {
    const m = order.source.match(/(?:^|[^a-z])lang[=:_-]?(en|es)(?:[^a-z]|$)/i);
    if (m) lang = m[1];
    else if (order.source.trim().toLowerCase() === 'en') lang = 'en';
  }
  return String(lang || 'es').toLowerCase() !== 'en';
}

function fmtMoney(n, currency) {
  const num = Number(n || 0);
  const s = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${s} ${currency || 'USD'}`;
}

// ── Email de guia de envio (cliente) ─────────────────────────────────────────

function shippedEmailHtml(order, isEs) {
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map((it) => {
    const name = esc(it.name || it.sku || 'Producto');
    const qty = Number(it.qty || it.quantity || 1);
    return `<tr>
      <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${name}</td>
      <td align="right" style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;font-family:monospace;">x ${qty}</td>
    </tr>`;
  }).join('');

  const addr = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : {};
  const addrParts = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code || addr.zip, addr.country]
    .filter(Boolean).map(esc).join(', ');

  const t = isEs ? {
    tag: 'BIOGRADIX · ENVÍO',
    title: 'Tu pedido va en camino',
    hello: `Hola ${esc(order.customer_name || '')}, tu pedido ya fue entregado a la paquetería. Aquí están los datos para rastrearlo.`,
    carrier: 'Paquetería',
    tracking: 'Número de guía',
    date: 'Fecha de envío',
    itemsTitle: 'Contenido del pedido',
    addrTitle: 'Dirección de entrega',
    help: 'Si tienes cualquier duda sobre tu envío, responde a este correo o escríbenos por WhatsApp.',
    contact: 'Contactar por WhatsApp',
  } : {
    tag: 'BIOGRADIX · SHIPPING',
    title: 'Your order is on the way',
    hello: `Hi ${esc(order.customer_name || '')}, your order has been handed to the carrier. Here is the tracking information.`,
    carrier: 'Carrier',
    tracking: 'Tracking number',
    date: 'Ship date',
    itemsTitle: 'Order contents',
    addrTitle: 'Delivery address',
    help: 'If you have any questions about your shipment, reply to this email or message us on WhatsApp.',
    contact: 'Contact via WhatsApp',
  };

  const shipDate = new Date().toLocaleDateString(isEs ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;overflow:hidden;border:1px solid #EDE8E0;">

  <tr><td style="background:#18140F;padding:28px 32px;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 8px;">${t.tag}</p>
    <h1 style="color:#F5F1EB;font-size:20px;margin:0 0 8px;font-weight:400;">${t.title}</h1>
    <p style="color:#9A9189;font-size:13px;line-height:1.6;margin:0;">${t.hello}</p>
  </td></tr>

  <tr><td style="background:#2E4A3A;padding:16px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#F5F1EB;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${esc(order.tracking_carrier || '')}</td>
      <td align="right" style="color:#F5F1EB;font-size:16px;font-family:monospace;letter-spacing:1px;">${esc(order.tracking_number || '')}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;width:40%;border-bottom:1px solid #EDE8E0;">${t.carrier}</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${esc(order.tracking_carrier || '')}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">${t.tracking}</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;font-family:monospace;">${esc(order.tracking_number || '')}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">${t.date}</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;">${shipDate}</td>
      </tr>
    </table>
  </td></tr>

  ${rows ? `
  <tr><td style="padding:24px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 10px;">${t.itemsTitle}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">${rows}
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">Total</td>
        <td align="right" style="padding:10px 14px;font-size:13px;color:#18140F;background:#F5F1EB;font-family:monospace;">${esc(fmtMoney(order.total, order.currency))}</td>
      </tr>
    </table>
  </td></tr>` : ''}

  ${addrParts ? `
  <tr><td style="padding:24px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">${t.addrTitle}</p>
    <p style="font-size:13px;color:#4A443C;line-height:1.6;margin:0;">${addrParts}</p>
  </td></tr>` : ''}

  <tr><td style="padding:28px 32px;">
    <p style="font-size:12px;color:#9A9189;line-height:1.7;margin:0 0 16px;">${t.help}</p>
    <a href="https://wa.me/15553471798" style="display:inline-block;background:#18140F;color:#F5F1EB;text-decoration:none;padding:11px 22px;font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;">${t.contact}</a>
  </td></tr>

  <tr><td style="background:#F5F1EB;padding:14px 32px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX · biogradix.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendShippedEmail(order) {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, detail: 'RESEND_API_KEY no configurada' };
  }
  if (!order.customer_email) {
    return { sent: false, detail: 'El pedido no tiene customer_email' };
  }
  const isEs = orderIsSpanish(order);
  const subject = isEs
    ? `Tu pedido va en camino — Guía ${order.tracking_number}`
    : `Your order is on the way — Tracking ${order.tracking_number}`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Biogradix <protocolos@biogradix.com>',
      to: [order.customer_email],
      bcc: [ADMIN_EMAIL],
      subject,
      html: shippedEmailHtml(order, isEs),
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    console.error('Resend shipped email error:', err);
    return { sent: false, detail: `Resend respondió ${r.status}` };
  }
  return { sent: true };
}

// ── Acciones ─────────────────────────────────────────────────────────────────

async function ordersList(req, res) {
  const status = (req.query && req.query.status) || (req.body && req.body.status);
  let limit = parseInt((req.query && req.query.limit) || (req.body && req.body.limit) || '200', 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > 200) limit = 200;

  let path = `biogradix_orders?select=*&order=created_at.desc&limit=${limit}`;
  if (status) {
    if (!ORDER_STATUSES.includes(status)) {
      return sendError(res, 400, 'bad_request', `Estado inválido: ${status}`);
    }
    path += `&status=eq.${status}`;
  }
  const r = await sb(path);
  if (r.missingTable) return tableError(res, 'biogradix_orders');
  if (!r.ok) return dbError(res, r);
  return res.status(200).json({ orders: r.data || [] });
}

async function ordersUpdateStatus(req, res) {
  const { order_id, status } = req.body || {};
  if (!order_id || !status) {
    return sendError(res, 400, 'bad_request', 'Faltan order_id o status');
  }
  if (!ORDER_STATUSES.includes(status)) {
    return sendError(res, 400, 'bad_request', `Estado inválido: ${status}`);
  }
  const r = await sb(`biogradix_orders?id=eq.${encodeURIComponent(order_id)}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body: { status },
  });
  if (r.missingTable) return tableError(res, 'biogradix_orders');
  if (!r.ok) return dbError(res, r);
  if (!Array.isArray(r.data) || r.data.length === 0) {
    return sendError(res, 404, 'not_found', `No existe el pedido ${order_id}`);
  }
  return res.status(200).json({ order: r.data[0] });
}

async function ordersMarkShipped(req, res) {
  const { order_id, carrier, tracking_number } = req.body || {};
  if (!order_id || !carrier || !tracking_number) {
    return sendError(res, 400, 'bad_request', 'Faltan order_id, carrier o tracking_number');
  }
  const r = await sb(`biogradix_orders?id=eq.${encodeURIComponent(order_id)}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body: {
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      tracking_carrier: String(carrier).trim(),
      tracking_number: String(tracking_number).trim(),
    },
  });
  if (r.missingTable) return tableError(res, 'biogradix_orders');
  if (!r.ok) return dbError(res, r);
  if (!Array.isArray(r.data) || r.data.length === 0) {
    return sendError(res, 404, 'not_found', `No existe el pedido ${order_id}`);
  }

  const order = r.data[0];
  let email = { sent: false, detail: 'sin intento' };
  try {
    email = await sendShippedEmail(order);
  } catch (err) {
    console.error('Shipped email error:', err);
    email = { sent: false, detail: 'Excepción al enviar el correo' };
  }
  return res.status(200).json({ order, email_sent: email.sent, email_detail: email.detail || null });
}

async function inventoryList(req, res) {
  const r = await sb('biogradix_products?select=*&order=sku.asc');
  if (r.missingTable) return tableError(res, 'biogradix_products');
  if (!r.ok) return dbError(res, r);

  const products = (r.data || []).map((p) => {
    const stock = Number(p.stock || 0);
    const reserved = Number(p.reserved || 0);
    const price = Number(p.price || 0);
    return Object.assign({}, p, {
      available: stock - reserved,
      stock_value: Math.round(stock * price * 100) / 100,
    });
  });
  const totals = {
    units: products.reduce((s, p) => s + Number(p.stock || 0), 0),
    stock_value: Math.round(products.reduce((s, p) => s + p.stock_value, 0) * 100) / 100,
    currency: products.length ? (products[0].currency || 'USD') : 'USD',
  };
  return res.status(200).json({ products, totals });
}

async function inventoryAdjust(req, res) {
  const { sku, reason } = req.body || {};
  const delta = parseInt(req.body && req.body.delta, 10);
  const note = req.body && req.body.note ? String(req.body.note).trim().slice(0, 500) : null;

  if (!sku || !Number.isFinite(delta)) {
    return sendError(res, 400, 'bad_request', 'Faltan sku o delta');
  }
  if (delta === 0) {
    return sendError(res, 400, 'bad_request', 'El ajuste no puede ser cero');
  }
  if (Math.abs(delta) > 100000) {
    return sendError(res, 400, 'bad_request', 'Ajuste fuera de rango');
  }
  if (!ADJUST_REASONS.includes(reason)) {
    return sendError(res, 400, 'bad_request', `Motivo inválido: ${reason}. Usa: ${ADJUST_REASONS.join(', ')}`);
  }

  // 1. Leer stock actual.
  const cur = await sb(`biogradix_products?select=sku,stock&sku=eq.${encodeURIComponent(sku)}&limit=1`);
  if (cur.missingTable) return tableError(res, 'biogradix_products');
  if (!cur.ok) return dbError(res, cur);
  if (!Array.isArray(cur.data) || cur.data.length === 0) {
    return sendError(res, 404, 'not_found', `No existe el SKU ${sku}`);
  }
  const oldStock = Number(cur.data[0].stock || 0);
  const newStock = oldStock + delta;
  if (newStock < 0) {
    return sendError(res, 409, 'insufficient_stock',
      `Stock insuficiente: ${oldStock} disponibles, el ajuste dejaría ${newStock}`);
  }

  // 2. Escritura condicionada al stock leido (optimista): si otro proceso
  //    movio el stock entre lectura y escritura, no se aplica nada.
  const upd = await sb(
    `biogradix_products?sku=eq.${encodeURIComponent(sku)}&stock=eq.${oldStock}`,
    { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: { stock: newStock } }
  );
  if (!upd.ok) return dbError(res, upd);
  if (!Array.isArray(upd.data) || upd.data.length === 0) {
    return sendError(res, 409, 'stock_changed',
      'El stock cambió mientras se aplicaba el ajuste. Recarga e intenta de nuevo.');
  }

  // 3. Registrar el movimiento en el historial.
  const mov = await sb('biogradix_inventory_movements', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: { sku, delta, reason, note, order_id: null },
  });
  if (!mov.ok) {
    console.error('Movement insert failed after stock update:', mov.status, mov.data);
    return res.status(200).json({
      product: upd.data[0],
      movement: null,
      warning: 'El stock se actualizó pero no se pudo registrar el movimiento en el historial.',
    });
  }
  return res.status(200).json({
    product: upd.data[0],
    movement: Array.isArray(mov.data) ? mov.data[0] : null,
  });
}

async function movementsList(req, res) {
  const r = await sb('biogradix_inventory_movements?select=*&order=created_at.desc&limit=50');
  if (r.missingTable) return tableError(res, 'biogradix_inventory_movements');
  if (!r.ok) return dbError(res, r);
  return res.status(200).json({ movements: r.data || [] });
}

async function leadsList(req, res) {
  const r = await sb('biogradix_quiz_leads?select=*&order=created_at.desc&limit=200');
  if (r.missingTable) return tableError(res, 'biogradix_quiz_leads');
  if (!r.ok) return dbError(res, r);
  return res.status(200).json({ leads: r.data || [] });
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Usa GET o POST');
  }

  if (!process.env.ADMIN_SECRET) {
    return sendError(res, 500, 'config_error', 'ADMIN_SECRET no está configurada en Vercel');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !safeEqual(token, process.env.ADMIN_SECRET)) {
    return sendError(res, 401, 'unauthorized', 'Frase de acceso incorrecta');
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return sendError(res, 500, 'config_error', 'SUPABASE_SERVICE_KEY no está configurada en Vercel');
  }

  const action = (req.query && req.query.action) || (req.body && req.body.action);
  const mutations = ['orders.updateStatus', 'orders.markShipped', 'inventory.adjust'];
  if (mutations.includes(action) && req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', `${action} requiere POST`);
  }

  try {
    switch (action) {
      case 'auth.check':       return res.status(200).json({ ok: true });
      case 'orders.list':      return await ordersList(req, res);
      case 'orders.updateStatus': return await ordersUpdateStatus(req, res);
      case 'orders.markShipped':  return await ordersMarkShipped(req, res);
      case 'inventory.list':   return await inventoryList(req, res);
      case 'inventory.adjust': return await inventoryAdjust(req, res);
      case 'movements.list':   return await movementsList(req, res);
      case 'leads.list':       return await leadsList(req, res);
      default:
        return sendError(res, 400, 'unknown_action', `Acción desconocida: ${action || '(vacia)'}`);
    }
  } catch (err) {
    console.error('Admin API error:', err);
    return sendError(res, 500, 'internal_error', 'Error interno del servidor');
  }
};
