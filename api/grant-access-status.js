// GET /api/grant-access-status?id=xxx
// Proxies to https://api.albato.com/credentials/grant-access-sharing/{id}
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id parameter' });

  try {
    const upstream = await fetch(`https://api.albato.com/credentials/grant-access-sharing/${id}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
