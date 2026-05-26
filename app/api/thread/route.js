import { NextResponse } from 'next/server';
import { slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');
  const ts = url.searchParams.get('ts');
  if (!channel || !ts) {
    return NextResponse.json({ error: 'channel and ts required' }, { status: 400 });
  }

  try {
    const data = await slackFetch('conversations.replies', {
      channel,
      ts,
      limit: 200,
    });
    return NextResponse.json({
      messages: (data.messages || []).map(m => ({
        ts: m.ts,
        user: m.user || m.bot_id || 'unknown',
        username: m.username || null,
        text: m.text || '',
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
