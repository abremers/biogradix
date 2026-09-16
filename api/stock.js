// GET /api/stock — Estado de inventario para el sitio publico.
//
// Devuelve SOLO booleanos por SKU, nunca cantidades: el front necesita saber
// si algo se puede comprar, no cuanto queda. Mismo criterio que el checkout:
// un producto esta disponible si active = true y (stock - reserved) > 0.
//
// La tabla tiene RLS sin politicas anon, asi que la lectura va con la service
// key del servidor. Si la key no esta configurada o Supabase falla, se
// responde con error y el front conserva el estado estatico del HTML.

const SUPABASE_URL = 'https://nimcmvtyamdgesmmmtyh.supabase.co';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://biogradix.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  // HEAD se trata como GET: lo usan los monitores de disponibilidad.
  // El runtime descarta el cuerpo y deja solo las cabeceras.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_SERVICE_KEY) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'stock_unavailable' });
  }

  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biogradix_products?select=sku,stock,reserved,active&order=sku.asc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (!dbRes.ok) throw new Error(`Supabase ${dbRes.status}`);

    const rows = await dbRes.json();
    if (!Array.isArray(rows)) throw new Error('Respuesta inesperada');

    const skus = {};
    for (const p of rows) {
      if (!p || typeof p.sku !== 'string') continue;
      const disponible = Number(p.stock || 0) - Number(p.reserved || 0);
      skus[p.sku] = p.active === true && disponible > 0;
    }

    // Cache corta en el CDN: el inventario cambia con cada venta, pero no
    // hace falta consultar Supabase en cada visita.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ skus, updated: new Date().toISOString() });
  } catch (err) {
    console.error('stock: lectura de inventario fallida:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'stock_unavailable' });
  }
};
