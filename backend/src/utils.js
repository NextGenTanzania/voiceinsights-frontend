// src/utils.js

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw { status: 401, message: 'Missing Authorization header' };
  const { verifyJWT } = await import('./auth.js');
  try {
    return await verifyJWT(token, env.JWT_SECRET);
  } catch (e) {
    throw { status: 401, message: 'Invalid or expired token' };
  }
}
