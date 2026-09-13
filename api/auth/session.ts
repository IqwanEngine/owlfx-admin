/* Powered by IqwanEngine */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawList = process.env.ADMIN_ALLOWED_EMAILS || process.env.VITE_ADMIN_ALLOWED_EMAILS || '';
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (req.method === 'GET') {
    const email = (req.query.email as string || '').trim().toLowerCase();
    const isWhitelisted = email ? allowed.includes(email) : false;

    return res.status(200).json({
      authenticated: isWhitelisted,
      email,
      isWhitelisted
    });
  }

  if (req.method === 'POST') {
    try {
      const { email } = req.body || {};
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email required' });
      }

      if (!allowed.includes(normalizedEmail)) {
        return res.status(403).json({
          error: '403 - Access Denied: Unauthorized Email',
          isAuthorized: false,
          email: normalizedEmail
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0].toUpperCase(),
          role: 'Secured Administrator',
          isAuthorized: true
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
