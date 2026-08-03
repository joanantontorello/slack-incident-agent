import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOKIE_NAME = 'pipeline_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function encodeCred(user, pass) {
  return Buffer.from(`${user}:${pass}`, 'utf-8').toString('base64');
}

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

export async function POST(req) {
  const creds = getValidCreds();
  if (creds.length === 0) {
    return NextResponse.json({ ok: true, note: 'auth disabled' });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const { user, pass } = body;
  const match = creds.find(c => c.user === user && c.pass === pass);
  if (!match) {
    return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 });
  }
  const token = encodeCred(match.user, match.pass);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
