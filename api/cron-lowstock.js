// api/cron-lowstock.js — Alerta diaria de inventario bajo.
// Programado en vercel.json: "0 14 * * *" UTC (08:00 CDMX).
// Vercel invoca el endpoint con Authorization: Bearer <CRON_SECRET>
// automaticamente cuando la env var CRON_SECRET existe en el proyecto.

const crypto = require('crypto');

const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const ADMIN_EMAIL = 'hello@biogradix.com';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alertHtml(lowProducts) {
  const rows = lowProducts.map((p) => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;font-family:monospace;">${esc(p.sku)}</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${esc(p.name || '')}</td>
        <td align="right" style="padding:10px 14px;font-size:13px;color:#7A2E2E;border-bottom:1px solid #EDE8E0;font-family:monospace;font-weight:600;">${Number(p.stock || 0)}</td>
        <td align="right" style="padding:10px 14px;font-size:13px;color:#9A9189;border-bottom:1px solid #EDE8E0;font-family:monospace;">${Number(p.low_stock_threshold || 0)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;overflow:hidden;border:1px solid #EDE8E0;">

  <tr><td style="background:#18140F;padding:24px 32px;border-bottom:2px solid #7A2E2E;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 4px;">BIOGRADIX · INVENTARIO</p>
    <h1 style="color:#F5F1EB;font-size:18px;margin:0;font-weight:400;">Alerta de inventario bajo</h1>
    <p style="color:#9A9189;font-size:12px;margin:6px 0 0;">${lowProducts.length} SKU${lowProducts.length === 1 ? '' : 's'} en o por debajo del umbral.</p>
  </td></tr>

  <tr><td style="padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      <tr>
        <td style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">SKU</td>
        <td style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Producto</td>
        <td align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Stock</td>
        <td align="right" style="padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Umbral</td>
      </tr>${rows}
    </table>
    <p style="font-size:12px;color:#9A9189;line-height:1.7;margin:16px 0 0;">Revisa el inventario y registra reabastecimientos en <a href="https://biogradix.com/admin.html" style="color:#2E4A3A;">el panel de operaciones</a>.</p>
  </td></tr>

  <tr><td style="background:#F5F1EB;padding:14px 32px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX · INTERNAL · biogradix.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ error: { code: 'config_error', message: 'CRON_SECRET no está configurada en Vercel' } });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !safeEqual(token, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'No autorizado' } });
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: { code: 'config_error', message: 'SUPABASE_SERVICE_KEY no está configurada en Vercel' } });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?select=sku,name,stock,low_stock_threshold,active&active=eq.true&order=sku.asc`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const code = data && data.code;
      if (code === '42P01' || code === 'PGRST205') {
        // La tabla de productos aun no existe (Fase 1 pendiente): no es un fallo del cron.
        return res.status(200).json({ success: true, skipped: 'biogradix_products no existe todavía' });
      }
      return res.status(502).json({ error: { code: 'db_error', message: `Supabase respondió ${r.status}` } });
    }

    // PostgREST no permite comparar dos columnas entre si en un filtro,
    // asi que el corte stock <= umbral se hace aqui (el catalogo es chico).
    const low = (Array.isArray(data) ? data : []).filter(
      (p) => Number(p.stock || 0) <= Number(p.low_stock_threshold || 0)
    );

    if (low.length === 0) {
      return res.status(200).json({ success: true, low: 0 });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: { code: 'config_error', message: 'RESEND_API_KEY no está configurada en Vercel' } });
    }

    const summary = low.map((p) => `${p.sku}: ${p.stock}/${p.low_stock_threshold}`).join(' · ');
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Biogradix <protocolos@biogradix.com>',
        to: [ADMIN_EMAIL],
        subject: `Inventario bajo: ${low.length} SKU${low.length === 1 ? '' : 's'} — ${summary}`,
        html: alertHtml(low),
      }),
    });
    if (!mail.ok) {
      const err = await mail.json().catch(() => ({}));
      console.error('Resend lowstock email error:', err);
      return res.status(502).json({ error: { code: 'email_error', message: `Resend respondió ${mail.status}` } });
    }

    return res.status(200).json({ success: true, low: low.length, skus: low.map((p) => p.sku) });
  } catch (err) {
    console.error('Cron lowstock error:', err);
    return res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del cron' } });
  }
};
