module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, lang, productName, peptide, productUrl, matchPct, why, dose, timing, duration, tips, cautions, secondaryName, secondaryUrl } = req.body || {};

  if (!name || !email || !productName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isEs = lang !== 'en';
  const subject = isEs
    ? `Tu protocolo personalizado de péptidos — ${name}`
    : `Your personalized peptide protocol — ${name}`;

  const tipsHtml = (tips || []).map(t => `<tr><td style="padding:6px 0;font-size:13px;color:#4A5568;border-bottom:1px solid #f0f0f0;line-height:1.5;">• ${t}</td></tr>`).join('');
  const cautsHtml = (cautions || []).map(c => `<tr><td style="padding:6px 0;font-size:13px;color:#4A5568;border-bottom:1px solid #f0f0f0;line-height:1.5;">⚠ ${c}</td></tr>`).join('');

  const html = `<!DOCTYPE html>
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
  <tr><td style="background:#0F6E56;padding:16px 40px;display:flex;align-items:center;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#fff;font-size:14px;font-weight:500;">${productName} <span style="font-family:monospace;font-size:10px;letter-spacing:1px;opacity:0.7;">${peptide}</span></td>
      <td align="right" style="font-family:monospace;color:#fff;font-size:22px;font-weight:500;">${matchPct}% <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">${isEs ? 'MATCH' : 'MATCH'}</span></td>
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

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Biogradix <protocolos@biogradix.com>',
        to: [email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
