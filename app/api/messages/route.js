import { NextResponse } from 'next/server';
import { slackFetch, getChannelsConfig } from '../../lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '14', 10);
  const oldest = Math.floor(Date.now() / 1000 - days * 86400);

  const channels = getChannelsConfig();
  if (channels.length === 0) {
    return NextResponse.json({ error: 'No channels configured in SLACK_CHANNELS' }, { status: 500 });
  }

  try {
    const results = await Promise.all(channels.map(async (ch) => {
      const data = await slackFetch('conversations.history', {
        channel: ch.id,
        oldest: String(oldest),
        limit: 100,
      });
      return {
        channel: ch.id,
        filter: ch.filter,
        messages: (data.messages || []).map(m => ({
          ts: m.ts,
          user: m.user || m.bot_id || 'unknown',
          username: m.username || null,
          text: m.text || '',
          reply_count: m.reply_count || 0,
          reactions: (m.reactions || []).map(r => ({ name: r.name, count: r.count })),
          subtype: m.subtype || null,
        })),
      };
    }));
    return NextResponse.json({ channels: results }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
