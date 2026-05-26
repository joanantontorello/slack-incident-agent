import { NextResponse } from 'next/server';
import { slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple in-memory cache (per cold-start)
const userCache = new Map();

export async function GET(request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids param required (comma-separated)' }, { status: 400 });
  }
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  const result = {};
  const missing = [];
  for (const id of ids) {
    if (userCache.has(id)) {
      result[id] = userCache.get(id);
    } else {
      missing.push(id);
    }
  }

  await Promise.all(missing.map(async (id) => {
    try {
      const data = await slackFetch('users.info', { user: id });
      const name = data.user?.real_name || data.user?.profile?.display_name || data.user?.name || id;
      userCache.set(id, name);
      result[id] = name;
    } catch (e) {
      result[id] = id;
    }
  }));

  return NextResponse.json({ users: result }, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
