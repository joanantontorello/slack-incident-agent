import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

export function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  // If no auth is configured, allow access (useful for local dev)
  if (!user || !pass) return NextResponse.next();

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = atob(encoded);
        const sep = decoded.indexOf(':');
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        if (u === user && p === pass) {
          return NextResponse.next();
        }
      } catch (e) {}
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Pipeline Incidencias"',
    },
  });
}
