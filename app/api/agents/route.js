import { NextResponse } from 'next/server';
import { isKvEnabled } from '../../lib/kv';
import { isAgentsConfigured, launchAgents } from '../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET → { configured } para que el panel sepa si enseñar los agentes.
// lastSweep: resumen de la última revisión automática (16:00 de lunes a viernes).
export async function GET() {
  let lastSweep = null;
  if (isKvEnabled()) {
    try {
      const r = await fetch(`${process.env.KV_REST_API_URL}/get/pipeline-auto-sweep-last`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }, cache: 'no-store',
      }).then(x => x.json());
      if (r && r.result) lastSweep = typeof r.result === 'string' ? JSON.parse(r.result) : r.result;
    } catch (e) {}
  }
  return NextResponse.json({ configured: isAgentsConfigured() && isKvEnabled(), lastSweep });
}

// POST { cases: [{ channelId, ts, link, channelName, title }] }
// Arranca la rutina de agentes con esos hilos (lo usa el botón).
export async function POST(req) {
  if (!isAgentsConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json({ error: 'KV no configurado' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  try {
    const r = await launchAgents(new URL(req.url).origin, body.cases, { source: 'botón' });
    if (!r.count) return NextResponse.json({ error: 'sin hilos' }, { status: 400 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
