import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

const COOKIE_NAME = 'pipeline_auth';

function getEnvCreds() {
  const multi = process.env.BASIC_AUTH_USERS;
  if (multi) {
    return multi.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
      const sep = pair.indexOf(':');
      return { user: pair.slice(0, sep), pass: pair.slice(sep + 1) };
    }).filter(c => c.user && c.pass);
  }
  const u = process.env.BASIC_AUTH_USER;
  const p = process.env.BASIC_AUTH_PASS;
  return u && p ? [{ user: u, pass: p }] : [];
}

// Cache in-memory de los usuarios KV para no hacer fetch en cada request.
// TTL 60s → cuando admin borra un usuario, la revocación tarda ≤1 min.
let kvUsersCache = null;
let kvUsersCacheExpires = 0;

async function getKvUsersCached() {
  if (Date.now() < kvUsersCacheExpires && kvUsersCache) return kvUsersCache;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) { kvUsersCache = []; kvUsersCacheExpires = Date.now() + 60000; return []; }
  try {
    const r = await fetch(`${url}/get/pipeline-users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await r.json();
    let users = [];
    if (data && data.result != null) {
      const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      if (Array.isArray(parsed)) users = parsed;
    }
    kvUsersCache = users;
    kvUsersCacheExpires = Date.now() + 60000;
    return users;
  } catch (e) {
    return kvUsersCache || [];
  }
}

function matches(creds, u, p) {
  return creds.some(c => c.user === u && c.pass === p);
}

function isValidBasic(header, creds) {
  if (!header) return false;
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  try {
    const decoded = atob(encoded);
    const sep = decoded.indexOf(':');
    return matches(creds, decoded.slice(0, sep), decoded.slice(sep + 1));
  } catch (e) { return false; }
}

function isValidCookie(value, creds) {
  if (!value) return false;
  try {
    const decoded = atob(value);
    const sep = decoded.indexOf(':');
    return matches(creds, decoded.slice(0, sep), decoded.slice(sep + 1));
  } catch (e) { return false; }
}

export async function middleware(request) {
  const envCreds = getEnvCreds();
  const pathname = request.nextUrl.pathname;

  // /login y /api/login son públicos
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization');

  // Env vars → validación instantánea (mayoría de requests)
  if (envCreds.length > 0) {
    if (isValidCookie(cookie, envCreds)) return NextResponse.next();
    if (isValidBasic(authHeader, envCreds)) return NextResponse.next();
  } else {
    // Sin env creds NI KV configurado → dev local sin auth
    if (!process.env.KV_REST_API_URL) return NextResponse.next();
  }

  // Fallback: usuarios KV (cache 60s)
  const kvUsers = await getKvUsersCached();
  if (kvUsers.length > 0) {
    if (isValidCookie(cookie, kvUsers)) return NextResponse.next();
    if (isValidBasic(authHeader, kvUsers)) return NextResponse.next();
  }

  // Rutas /api sin auth → 401 JSON (para clientes programáticos)
  if (pathname.startsWith('/api/')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Pipeline Incidencias"' },
    });
  }

  // Páginas → redirect a /login (con ?next= para volver tras login)
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}
