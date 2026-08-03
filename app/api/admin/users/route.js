import { NextResponse } from 'next/server';
import { getKvUsers, addKvUser, removeKvUser, isKvEnabled } from '../../../lib/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Devuelve los usuarios "de entorno" (env vars, no editables desde UI)
function getEnvUsers() {
  const multi = process.env.BASIC_AUTH_USERS;
  if (multi) {
    return multi.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
      const sep = pair.indexOf(':');
      return { user: pair.slice(0, sep), pass: pair.slice(sep + 1), env: true };
    }).filter(c => c.user && c.pass);
  }
  const u = process.env.BASIC_AUTH_USER;
  const p = process.env.BASIC_AUTH_PASS;
  return u && p ? [{ user: u, pass: p, env: true }] : [];
}

export async function GET() {
  const envUsers = getEnvUsers();
  const kvUsers = isKvEnabled() ? await getKvUsers().catch(() => []) : [];
  return NextResponse.json({
    kvEnabled: isKvEnabled(),
    envUsers,
    kvUsers: kvUsers.map(u => ({ ...u, env: false })),
  });
}

export async function POST(req) {
  if (!isKvEnabled()) {
    return NextResponse.json({ error: 'KV no configurado — no se pueden añadir usuarios dinámicos' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const user = String(body.user || '').trim();
  const pass = String(body.pass || '');
  if (!user || !pass) {
    return NextResponse.json({ error: 'Usuario y contraseña son obligatorios' }, { status: 400 });
  }
  // Evitar colisión con env users
  const envUsers = getEnvUsers();
  if (envUsers.some(u => u.user === user)) {
    return NextResponse.json({ error: `"${user}" ya existe como usuario de sistema (env var)` }, { status: 400 });
  }
  try {
    const users = await addKvUser({ user, pass });
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 400 });
  }
}

export async function DELETE(req) {
  if (!isKvEnabled()) {
    return NextResponse.json({ error: 'KV no configurado' }, { status: 503 });
  }
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  if (!user) {
    return NextResponse.json({ error: 'user param requerido' }, { status: 400 });
  }
  try {
    const users = await removeKvUser(user);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
