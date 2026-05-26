import { NextResponse } from 'next/server';
import { getChannelsConfig, getMyUserId, slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';

// Cache team info per cold start
let cachedTeam = null;

async function getTeam() {
  if (cachedTeam) return cachedTeam;
  try {
    const data = await slackFetch('auth.test', {});
    cachedTeam = {
      team_id: data.team_id,
      team_domain: data.team, // workspace subdomain
      url: data.url, // e.g. https://adriasolapastor.slack.com/
    };
  } catch (e) {
    cachedTeam = { error: String(e.message || e) };
  }
  return cachedTeam;
}

export async function GET() {
  const team = await getTeam();
  return NextResponse.json({
    myUserId: getMyUserId(),
    channels: getChannelsConfig(),
    team,
  });
}
