import { NextResponse } from 'next/server';
import { slackFetch, getChannelsConfig, getActiveChannels } from '../../../lib/slack';
import { getKvChannels, setKvChannels, isKvEnabled } from '../../../lib/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Devuelve TODOS los canales (públicos + privados) donde el bot es miembro.
async function listAvailableChannels() {
  const result = [];
  let cursor;
  // Hasta 5 páginas por si hay muchos canales
  for (let i = 0; i < 5; i++) {
    const data = await slackFetch('users.conversations', {
      types: 'public_channel,private_channel',
      limit: 200,
      exclude_archived: true,
      ...(cursor ? { cursor } : {}),
    });
    for (const c of (data.channels || [])) {
      result.push({
        id: c.id,
        name: c.name,
        is_private: !!c.is_private,
        num_members: c.num_members || 0,
      });
    }
    cursor = data?.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  // Orden alfabético por nombre
  result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return result;
}

export async function GET() {
  try {
    const [available, active, kvList] = await Promise.all([
      listAvailableChannels().catch(e => ({ error: String(e.message || e) })),
      getActiveChannels(),
      isKvEnabled() ? getKvChannels() : Promise.resolve(null),
    ]);
    return NextResponse.json({
      kvEnabled: isKvEnabled(),
      source: kvList && kvList.length > 0 ? 'kv' : 'env',
      envChannels: getChannelsConfig(),
      kvChannels: kvList || [],
      activeChannels: active,
      availableChannels: Array.isArray(available) ? available : [],
      availableError: Array.isArray(available) ? null : (available?.error || null),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isKvEnabled()) {
    return NextResponse.json({ error: 'KV no configurado — no se puede guardar la selección' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const channels = Array.isArray(body.channels) ? body.channels : null;
  if (!channels) {
    return NextResponse.json({ error: 'channels array requerido' }, { status: 400 });
  }
  try {
    const saved = await setKvChannels(channels);
    return NextResponse.json({ ok: true, channels: saved });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
