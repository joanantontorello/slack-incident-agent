import { NextResponse } from 'next/server';
import { applyPatches } from '../../../lib/kv';
import { getRun } from '../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// La rutina de agentes escribe aquí el resultado de cada hilo.
// Sin login del panel: se valida con el PASE de un solo envío (caduca en 6 h)
// y solo deja tocar los hilos que venían en ese envío.
// POST { pase, caseId, estado: 'borrador'|'sin_borrador'|'error', caso, nota }
const ESTADOS = { borrador: 'draft', sin_borrador: 'nodraft', error: 'error' };

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const run = await getRun(body.pase).catch(() => null);
  if (!run) return NextResponse.json({ error: 'pase no válido o caducado' }, { status: 401 });
  const caseId = String(body.caseId || '');
  if (!run.caseIds.includes(caseId)) {
    return NextResponse.json({ error: 'ese hilo no estaba en este envío' }, { status: 403 });
  }
  const agentStatus = ESTADOS[body.estado] || 'nodraft';
  await applyPatches([{
    caseId,
    patch: {
      agentStatus,
      agentCase: String(body.caso || '').slice(0, 60),
      agentNote: String(body.nota || '').slice(0, 700),
      agentDoneAt: Date.now(),
    },
  }]);
  return NextResponse.json({ ok: true });
}
