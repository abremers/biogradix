const SUPABASE_URL = 'https://mwfnvqsyvvzpkjwqasbk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Zm52cXN5dnZ6cGtqd3Fhc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTI5MTcsImV4cCI6MjA5MTkyODkxN30.lfrLJp1SRCcRGNSnhUOVeDueMfaKK-36hy5twwEW0iY';
const ADMIN_EMAIL = 'hello@biogradix.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email, lang,
    productName, peptide, productUrl, matchPct, why,
    dose, timing, duration, tips, cautions,
    secondaryName, secondaryUrl,
    // Quiz profile data
    age, sex, goals, activity, conditions, symptoms,
  } = req.body || {};

  if (!name || !email || !productName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isEs = lang !== 'en';

  // ── 1. SAVE LEAD TO SUPABASE ─────────────────────────────────────────────────
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/biogradix_quiz_leads`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        name, email, lang,
        age, sex,
        goals: goals || [],
        activity,
        conditions: conditions || [],
        symptoms: symptoms || [],
        product_name: productName,
        peptide,
        match_pct: matchPct,
        secondary_name: secondaryName || null,
        product_url: productUrl,
      }),
    });
  } catch (err) {
    console.error('Supabase insert error:', err);
    // Non-fatal — continue sending emails even if DB write fails
  }

  // ── 2. CLIENT PROTOCOL EMAIL ─────────────────────────────────────────────────
  const subject = isEs
    ? `Tu protocolo personalizado de péptidos — ${name}`
    : `Your personalized peptide protocol — ${name}`;

  const tipsHtml = (tips || []).map(t => `<tr><td style="padding:6px 0;font-size:13px;color:#4A5568;border-bottom:1px solid #f0f0f0;line-height:1.5;">• ${t}</td></tr>`).join('');
  const cautsHtml = (cautions || []).map(c => `<tr><td style="padding:6px 0;font-size:13px;color:#4A5568;border-bottom:1px solid #f0f0f0;line-height:1.5;">⚠ ${c}</td></tr>`).join('');

  const clientHtml = `<!DOCTYPE html>
<html lang="${lang || 'es'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background:#0B1A2B;padding:32px 40px;">
    <p style="font-family:monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#1D9E75;margin:0 0 10px;">BIOGRADIX</p>
    <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px;font-weight:500;line-height:1.3;">${isEs ? 'Tu Protocolo Personalizado' : 'Your Personalized Protocol'}</h1>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0;">${isEs ? `Hola ${name}, aquí está tu recomendación basada en tu perfil.` : `Hi ${name}, here's your recommendation based on your profile.`}</p>
  </td></tr>

  <!-- MATCH BANNER -->
  <tr><td style="background:#0F6E56;padding:16px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#fff;font-size:14px;font-weight:500;">${productName} <span style="font-family:monospace;font-size:10px;letter-spacing:1px;opacity:0.7;">${peptide}</span></td>
      <td align="right" style="font-family:monospace;color:#fff;font-size:22px;font-weight:500;">${matchPct}% <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">MATCH</span></td>
    </tr></table>
  </td></tr>

  <!-- WHY -->
  <tr><td style="padding:32px 40px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#0F6E56;margin:0 0 10px;">${isEs ? '¿Por qué este péptido para ti?' : 'Why this peptide for you?'}</p>
    <p style="font-size:14px;color:#4A5568;line-height:1.7;margin:0;">${why}</p>
  </td></tr>

  <!-- PROTOCOL GRID -->
  <tr><td style="padding:24px 40px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#0F6E56;margin:0 0 14px;">${isEs ? 'Protocolo de uso' : 'Usage protocol'}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding:14px;background:#f8fafb;border-radius:10px;vertical-align:top;">
          <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#0F6E56;margin:0 0 4px;">${isEs ? 'Dosis' : 'Dosage'}</p>
          <p style="font-size:13px;color:#0B1A2B;font-weight:600;margin:0;line-height:1.4;">${dose}</p>
        </td>
        <td width="4%" style="padding:0 8px;"></td>
        <td width="30%" style="padding:14px;background:#f8fafb;border-radius:10px;vertical-align:top;">
          <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#0F6E56;margin:0 0 4px;">${isEs ? 'Aplicación' : 'Application'}</p>
          <p style="font-size:13px;color:#0B1A2B;font-weight:600;margin:0;line-height:1.4;">${timing}</p>
        </td>
        <td width="4%" style="padding:0 8px;"></td>
        <td width="29%" style="padding:14px;background:#f8fafb;border-radius:10px;vertical-align:top;">
          <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#0F6E56;margin:0 0 4px;">${isEs ? 'Duración' : 'Duration'}</p>
          <p style="font-size:13px;color:#0B1A2B;font-weight:600;margin:0;line-height:1.4;">${duration}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- TIPS -->
  <tr><td style="padding:24px 40px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#0F6E56;margin:0 0 10px;">${isEs ? 'Para mejores resultados' : 'For best results'}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${tipsHtml}</table>
  </td></tr>

  <!-- CAUTIONS -->
  <tr><td style="padding:20px 40px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin:0 0 10px;">${isEs ? 'Precauciones' : 'Precautions'}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${cautsHtml}</table>
  </td></tr>

  ${secondaryName ? `
  <!-- SECONDARY -->
  <tr><td style="padding:24px 40px 0;">
    <a href="https://biogradix.com${secondaryUrl}" style="display:block;background:#f8fafb;border-radius:10px;padding:16px 20px;text-decoration:none;">
      <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8A9BAD;margin:0 0 4px;">${isEs ? 'Complemento recomendado' : 'Recommended complement'}</p>
      <p style="font-size:14px;color:#0B1A2B;font-weight:600;margin:0;">${secondaryName} <span style="color:#0F6E56;">→</span></p>
    </a>
  </td></tr>` : ''}

  <!-- CTA -->
  <tr><td style="padding:32px 40px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;">
        <a href="https://biogradix.com${productUrl}" style="display:inline-block;background:#0F6E56;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-family:monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">${isEs ? 'Ver producto →' : 'View product →'}</a>
      </td>
      <td>
        <a href="https://wa.me/13467189350" style="display:inline-block;background:transparent;color:#0F6E56;text-decoration:none;padding:12px 24px;border-radius:10px;border:1.5px solid #0F6E56;font-family:monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">${isEs ? 'Consulta gratis por WhatsApp' : 'Free WhatsApp consultation'}</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- DISCLAIMER -->
  <tr><td style="padding:0 40px 32px;">
    <div style="background:#f8fafb;border-radius:10px;padding:16px 20px;">
      <p style="font-size:11px;color:#8A9BAD;line-height:1.7;margin:0;">
        <strong style="color:#4A5568;">${isEs ? 'Aviso legal:' : 'Legal disclaimer:'}</strong>
        ${isEs
          ? ' Esta recomendación es orientativa y no reemplaza la consulta médica profesional. Los péptidos mencionados son compuestos de bienestar, no medicamentos aprobados para los usos indicados. Consulta siempre con un médico antes de iniciar cualquier protocolo.'
          : ' This recommendation is advisory and does not replace professional medical consultation. The peptides mentioned are wellness compounds, not medications approved for the indicated uses. Always consult a physician before starting any protocol.'}
      </p>
    </div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0B1A2B;padding:20px 40px;text-align:center;">
    <p style="font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin:0;">© 2025 BIOGRADIX · biogradix.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // ── 3. ADMIN NOTIFICATION EMAIL ──────────────────────────────────────────────
  const goalsStr  = (goals || []).join(', ') || '—';
  const condStr   = (conditions || []).join(', ') || 'Ninguna';
  const sympStr   = (symptoms || []).join(', ') || '—';

  const adminHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;overflow:hidden;">

  <!-- HEADER -->
  <tr><td style="background:#18140F;padding:24px 32px;border-bottom:2px solid #2E4A3A;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 4px;">BIOGRADIX · NUEVO LEAD</p>
    <h1 style="color:#F5F1EB;font-size:18px;margin:0;font-weight:400;">${name}</h1>
    <p style="color:#9A9189;font-size:12px;margin:4px 0 0;"><a href="mailto:${email}" style="color:#2E4A3A;">${email}</a></p>
  </td></tr>

  <!-- MATCH -->
  <tr><td style="background:#2E4A3A;padding:14px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#F5F1EB;font-size:13px;font-weight:500;">${productName} <span style="opacity:0.6;font-size:11px;">${peptide}</span></td>
      <td align="right" style="color:#F5F1EB;font-size:20px;font-weight:300;font-family:monospace;">${matchPct}%</td>
    </tr></table>
  </td></tr>

  <!-- PROFILE TABLE -->
  <tr><td style="padding:28px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 14px;">Perfil del cliente</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE8E0;">
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;width:36%;border-bottom:1px solid #EDE8E0;">Idioma</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${lang === 'en' ? 'English' : 'Español'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Edad</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${age || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Sexo</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${sex || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Actividad</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${activity || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Objetivos</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${goalsStr}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;border-bottom:1px solid #EDE8E0;">Síntomas</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;border-bottom:1px solid #EDE8E0;">${sympStr}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9A9189;background:#F5F1EB;">Condiciones</td>
        <td style="padding:10px 14px;font-size:13px;color:#18140F;">${condStr}</td>
      </tr>
    </table>
  </td></tr>

  ${secondaryName ? `
  <!-- SECONDARY -->
  <tr><td style="padding:16px 32px 0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A9189;margin:0 0 6px;">Complemento recomendado</p>
    <p style="font-size:13px;color:#2E4A3A;margin:0;">${secondaryName}</p>
  </td></tr>` : ''}

  <!-- ACTIONS -->
  <tr><td style="padding:24px 32px 32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;">
        <a href="https://wa.me/13467189350?text=Hola%20${encodeURIComponent(name)},%20vi%20tu%20perfil%20en%20Biogradix..." style="display:inline-block;background:#18140F;color:#F5F1EB;text-decoration:none;padding:10px 20px;font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;">Contactar →</a>
      </td>
      <td>
        <a href="mailto:${email}" style="display:inline-block;background:transparent;color:#18140F;text-decoration:none;padding:9px 20px;border:1px solid #EDE8E0;font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;">Responder email</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#F5F1EB;padding:14px 32px;border-top:1px solid #EDE8E0;">
    <p style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9A9189;margin:0;">BIOGRADIX · INTERNAL · biogradix.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // ── 4. SEND BOTH EMAILS ──────────────────────────────────────────────────────
  try {
    const resendHeaders = {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // Client email (with BCC to admin)
    const clientRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: resendHeaders,
      body: JSON.stringify({
        from: 'Biogradix <protocolos@biogradix.com>',
        to: [email],
        bcc: [ADMIN_EMAIL],
        subject,
        html: clientHtml,
      }),
    });

    if (!clientRes.ok) {
      const err = await clientRes.json().catch(() => ({}));
      console.error('Resend client email error:', err);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    // Admin notification (separate, richer email)
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: resendHeaders,
      body: JSON.stringify({
        from: 'Biogradix Leads <protocolos@biogradix.com>',
        to: [ADMIN_EMAIL],
        subject: `🧬 Nuevo lead: ${name} → ${productName} (${matchPct}%)`,
        html: adminHtml,
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
