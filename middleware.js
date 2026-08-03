import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

const COOKIE_NAME = 'pipeline_auth';

// Lista de credenciales válidas. BASIC_AUTH_USERS admite formato
// "user1:pass1,user2:pass2,…" para soportar múltiples usuarios.
// Retrocompatibilidad: si no está, cae a BASIC_AUTH_USER / BASIC_AUTH_PASS.
function getValidCreds() {
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

export function middleware(request) {
  const creds = getValidCreds();

  // Sin auth configurada → pasar (dev local)
  if (creds.length === 0) return NextResponse.next();

  const pathname = request.nextUrl.pathname;

  // /login y /api/login son públicos
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (isValidCookie(cookie, creds)) return NextResponse.next();

  // Basic auth por header sigue funcionando (para /api con curl, etc.)
  const authHeader = request.headers.get('authorization');
  if (isValidBasic(authHeader, creds)) return NextResponse.next();

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
