// POST /api/run-info
// Proxies to https://uapi.albato.com/partners/trigger-actions/10025156/run/info
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'] || '';

  try {
    const upstream = await fetch(
      'https://uapi.albato.com/partners/trigger-actions/10025156/run/info',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify(req.body)
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
