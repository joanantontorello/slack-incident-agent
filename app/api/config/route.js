import { NextResponse } from 'next/server';
import { getActiveChannels, getMyUserId, getAutoDoneUserIds, slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';

// Cache team info per cold start
let cachedTeam = null;
// Cache channel info (id → name) por cold start — ahorra una llamada por canal
const cachedChannelNames = new Map();

async function getTeam() {
  if (cachedTeam) return cachedTeam;
  try {
    const data = await slackFetch('auth.test', {});
    cachedTeam = {
      team_id: data.team_id,
      team_domain: data.team,
      url: data.url,
    };
  } catch (e) {
    cachedTeam = { error: String(e.message || e) };
  }
  return cachedTeam;
}

async function getChannelName(id) {
  if (cachedChannelNames.has(id)) return cachedChannelNames.get(id);
  try {
    const data = await slackFetch('conversations.info', { channel: id });
    const name = data?.channel?.name || id;
    cachedChannelNames.set(id, name);
    return name;
  } catch (e) {
    cachedChannelNames.set(id, id);
    return id;
  }
}

export async function GET() {
  const team = await getTeam();
  const channels = await getActiveChannels();
  const enriched = await Promise.all(channels.map(async c => ({
    ...c,
    name: await getChannelName(c.id),
  })));
  return NextResponse.json({
    myUserId: getMyUserId(),
    autoDoneUserIds: getAutoDoneUserIds(),
    channels: enriched,
    team,
  });
}
