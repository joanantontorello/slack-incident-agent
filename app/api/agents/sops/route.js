import { NextResponse } from 'next/server';
import { isKvEnabled } from '../../../lib/kv';
import { sopGroups } from '../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → { groups: [{ tema, count, sinFicha, dependeJoan, ejemplos: [{title, link, porQue, at}] }] }
// Casos del último mes que no tenían ficha en el manual o dependían de Joan.
export async function GET() {
  if (!isKvEnabled()) return NextResponse.json({ groups: [] });
  try {
    const groups = await sopGroups(30);
    return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ groups: [], error: String(e.message || e) }, { status: 500 });
  }
}
