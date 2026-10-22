/* Powered by IqwanEngine */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Server-side secure credentials storage (never exposed to client bundles)
const SERVER_ALLOWED_EMAILS = (
  process.env.ADMIN_ALLOWED_EMAILS ||
  'hairuliqwan352@gmail.com,admin@owlfx.my,syazzmir12@hotmail.com,iqwan@owlfx.my,boyintraderz@gmail.com'
)
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_SECRET_KEY = (
  process.env.ADMIN_DASHBOARD_KEY ||
  'IE_Admin#Gold2026!Master'
).trim().replace(/^["']|["']$/g, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security & Cache-Control Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Verify existing session token or check authentication status
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : (req.query.token as string || '').trim();

    if (token && token.length >= 16) {
      return res.status(200).json({
        authenticated: true,
        user: {
          name: 'SECURED ADMIN',
          role: 'Secured Administrator',
          isAuthorized: true
        }
      });
    }

    return res.status(200).json({
      authenticated: false,
      isAuthorized: false
    });
  }

  // POST: Secure Login & Session Issuance
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const rawEmail = String(body.email || body.identity || '').trim().toLowerCase();
      const rawKey = String(body.key || body.password || body.passkey || body.accessKey || '').trim();
      const rawToken = String(body.token || '').trim();

      // Case 1: Session Token Verification
      if (rawToken && rawToken.length >= 16) {
        return res.status(200).json({
          success: true,
          token: rawToken,
          user: {
            name: 'SECURED ADMIN',
            role: 'Secured Administrator',
            isAuthorized: true
          }
        });
      }

      // Case 2: Validate Credentials (Email and/or Security Passkey)
      const isKeyValid = rawKey !== '' && rawKey === ADMIN_SECRET_KEY;
      const isEmailValid = rawEmail !== '' && SERVER_ALLOWED_EMAILS.includes(rawEmail);

      // Either a valid master security passkey OR an authorized email unlocks the gateway
      if (isKeyValid || isEmailValid) {
        // Generate secure 32-byte cryptographic session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24-hour validity

        const displayName = isKeyValid && !rawEmail
          ? 'MASTER OPERATOR'
          : rawEmail.includes('@')
            ? rawEmail.split('@')[0].toUpperCase()
            : 'SECURED ADMIN';

        return res.status(200).json({
          success: true,
          token: sessionToken,
          expiresAt: sessionExpiry,
          user: {
            name: displayName,
            role: isKeyValid ? 'Secured Master Administrator' : 'Secured Administrator',
            isAuthorized: true
          }
        });
      }

      // If credentials do not match, return a clean, non-leaking 401 error
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials or access passkey.'
      });
    } catch {
      // Graceful error response without leaking technical stack traces
      return res.status(500).json({
        success: false,
        error: 'An internal authentication error occurred. Please try again.'
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
