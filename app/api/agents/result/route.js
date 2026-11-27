import { NextResponse } from 'next/server';
import { applyPatches } from '../../../lib/kv';
import { getRun, appendLog } from '../../../lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// La rutina de agentes escribe aquí el resultado de cada hilo.
// Sin login del panel: se valida con el PASE de un solo envío (caduca en 6 h)
// y solo deja tocar los hilos que venían en ese envío.
// POST { pase, caseId, estado: 'borrador'|'sin_borrador'|'nota'|'error', caso, nota,
//        ficha, tema, sin_ficha, depende_de_joan, por_que }
// 'nota' = el hilo ya tenía borrador y solo se actualiza la nota.
const ESTADOS = { borrador: 'draft', sin_borrador: 'nodraft', nota: 'draft', error: 'error' };
const yes = (v) => v === true || v === 'true' || v === 'sí' || v === 'si';

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
  const now = Date.now();
  const patch = {
    agentStatus,
    agentCase: String(body.caso || '').slice(0, 60),
    agentNote: String(body.nota || '').slice(0, 700),
    agentFicha: String(body.ficha || '').slice(0, 80),
    agentDoneAt: now,
  };
  // Fecha del borrador (sirve para saber si Joan ya lo ha usado y no crear
  // otro en el mismo hilo). Con 'nota' se conserva la del borrador original.
  if (body.estado === 'borrador') patch.agentDraftAt = now;
  await applyPatches([{ caseId, patch }]);

  const meta = (Array.isArray(run.cases) ? run.cases : []).find(c => c.caseId === caseId) || {};
  try {
    await appendLog({
      at: now,
      caseId,
      title: meta.title || '',
      link: meta.link || '',
      channelName: meta.channelName || '',
      source: run.source || '',
      estado: String(body.estado || ''),
      caso: patch.agentCase,
      ficha: patch.agentFicha,
      tema: String(body.tema || '').slice(0, 90),
      sinFicha: yes(body.sin_ficha),
      dependeJoan: yes(body.depende_de_joan),
      porQue: String(body.por_que || '').slice(0, 300),
    });
  } catch (e) {
    console.warn('agent log:', e);
  }
  return NextResponse.json({ ok: true });
}
