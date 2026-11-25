import { NextResponse } from 'next/server';
import { applyPatches, isKvEnabled } from '../../lib/kv';
import { isAgentsConfigured, newRunToken, saveRun, fetchManualText, fireRoutine } from '../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_CASES = 15;

// GET → { configured } para que el panel sepa si enseñar los agentes.
export async function GET() {
  return NextResponse.json({ configured: isAgentsConfigured() && isKvEnabled() });
}

// POST { cases: [{ caseId, channelId, ts, link, channelName, title }] }
// Arranca la rutina de agentes con esos hilos.
export async function POST(req) {
  if (!isAgentsConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json({ error: 'KV no configurado' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const cases = (Array.isArray(body.cases) ? body.cases : [])
    .filter(c => c && /^[CDG][A-Z0-9]+$/.test(c.channelId || '') && /^\d+\.\d+$/.test(c.ts || ''))
    .slice(0, MAX_CASES)
    .map(c => ({
      caseId: `${c.channelId}-${c.ts}`,
      channelId: c.channelId,
      ts: c.ts,
      link: String(c.link || ''),
      channelName: String(c.channelName || ''),
      title: String(c.title || '').slice(0, 140),
    }));
  if (cases.length === 0) {
    return NextResponse.json({ error: 'sin hilos' }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const token = newRunToken();
  let manual = '';
  try { manual = await fetchManualText(origin); } catch (e) { manual = '(No se pudo leer el manual: ' + String(e.message || e) + ')'; }

  await saveRun(token, { caseIds: cases.map(c => c.caseId), createdAt: Date.now() });

  const text = [
    `PASE: ${token}`,
    `URL_RESULTADOS: ${origin}/api/agents/result`,
    `FECHA: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'HILOS:',
    ...cases.map((c, i) => `${i + 1}. caseId=${c.caseId} | canal=${c.channelId} (#${c.channelName}) | thread_ts=${c.ts} | enlace=${c.link} | título: ${c.title}`),
    '',
    '=== MANUAL DEL PIPELINE (protocolos) ===',
    manual,
  ].join('\n');

  try {
    const fired = await fireRoutine(text);
    const now = Date.now();
    await applyPatches(cases.map(c => ({
      caseId: c.caseId,
      patch: { agentStatus: 'working', agentAt: now, agentNote: '', agentSessionUrl: fired.claude_code_session_url || '' },
    })));
    return NextResponse.json({ ok: true, count: cases.length, sessionUrl: fired.claude_code_session_url || '' });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
