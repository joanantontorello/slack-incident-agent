import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

const COOKIE_NAME = 'pipeline_auth';

function isValidBasic(header, user, pass) {
  if (!header) return false;
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  try {
    const decoded = atob(encoded);
    const sep = decoded.indexOf(':');
    return decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass;
  } catch (e) { return false; }
}

function isValidCookie(value, user, pass) {
  if (!value) return false;
  try {
    const decoded = atob(value);
    const sep = decoded.indexOf(':');
    return decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass;
  } catch (e) { return false; }
}

export function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  // Sin auth configurada → pasar (dev local)
  if (!user || !pass) return NextResponse.next();

  const pathname = request.nextUrl.pathname;

  // /login y /api/login son públicos
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (isValidCookie(cookie, user, pass)) return NextResponse.next();

  // Basic auth por header sigue funcionando (para /api con curl, etc.)
  const authHeader = request.headers.get('authorization');
  if (isValidBasic(authHeader, user, pass)) return NextResponse.next();

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
