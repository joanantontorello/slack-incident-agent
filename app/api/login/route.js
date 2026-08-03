import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOKIE_NAME = 'pipeline_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function encodeCred(user, pass) {
  return Buffer.from(`${user}:${pass}`, 'utf-8').toString('base64');
}

export async function POST(req) {
  const envUser = process.env.BASIC_AUTH_USER;
  const envPass = process.env.BASIC_AUTH_PASS;
  if (!envUser || !envPass) {
    return NextResponse.json({ ok: true, note: 'auth disabled' });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const { user, pass } = body;
  if (user !== envUser || pass !== envPass) {
    return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 });
  }
  const token = encodeCred(envUser, envPass);
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
