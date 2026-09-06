/* Powered by IqwanEngine */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email') || '';
  const rawList = process.env.ADMIN_ALLOWED_EMAILS || '';
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  const isWhitelisted = email ? allowed.includes(email.toLowerCase()) : false;

  return Response.json({
    authenticated: isWhitelisted,
    email,
    isWhitelisted
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || '').trim().toLowerCase();
    const rawList = process.env.ADMIN_ALLOWED_EMAILS || '';
    const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    if (!allowed.includes(email)) {
      return Response.json({
        error: '403 - Access Denied: Unauthorized Email',
        isAuthorized: false,
        email
      }, { status: 403 });
    }

    return Response.json({
      success: true,
      user: {
        email,
        name: email.split('@')[0].toUpperCase(),
        role: 'Secured Administrator',
        isAuthorized: true
      }
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
