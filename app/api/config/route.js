import { NextResponse } from 'next/server';
import { getChannelsConfig, getMyUserId } from '../../lib/slack';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    myUserId: getMyUserId(),
    channels: getChannelsConfig(),
  });
}
