// GET /api/actions-schema
// Proxies to https://uapi.albato.com/partners/trigger-actions/info
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'] || '';

  try {
    const upstream = await fetch(
      'https://uapi.albato.com/partners/trigger-actions/info?filter[partnerId]=10055&filter[isAction]=1',
      { headers: { Authorization: authHeader } }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
