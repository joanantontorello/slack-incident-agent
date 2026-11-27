import { applyPatches, getState } from './kv';
import { slackFetch, getMyUserId } from './slack';
// Agentes de incidencias: el botón «Revisar con IA» arranca una rutina de
// Claude Code en la nube (claude.ai/code/routines) y le pasa los hilos que
// esperan a Joan. La rutina lee cada hilo, mira Airtable, deja la respuesta
// como BORRADOR en el hilo de Slack y devuelve una nota a /api/agents/result.
//
// Variables de entorno (Vercel):
//   ROUTINE_FIRE_URL   → opcional; por defecto la de la rutina trig_01TZwkDsyUA5vp1RTefau9qr
//   ROUTINE_FIRE_TOKEN → token de la rutina (sk-ant-oat01-…), se genera en la web de la rutina
//
// Cada envío crea un «pase» de un solo uso (clave en KV con caducidad) para
// que la rutina pueda escribir las notas sin tener la contraseña del panel.

const RUN_PREFIX = 'pipeline-agent-run:';
const RUN_TTL_SECONDS = 6 * 60 * 60; // 6 h para terminar

function kvUrl() { return process.env.KV_REST_API_URL; }
function kvToken() { return process.env.KV_REST_API_TOKEN; }

async function kv(parts, body) {
  const url = `${kvUrl()}/${parts.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${kvToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV ${parts[0]} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Rutina «Agentes del Pipeline de Incidencias» (claude.ai/code/routines).
const DEFAULT_FIRE_URL = 'https://api.anthropic.com/v1/claude_code/routines/trig_01TZwkDsyUA5vp1RTefau9qr/fire';
function fireUrl() { return process.env.ROUTINE_FIRE_URL || DEFAULT_FIRE_URL; }

export function isAgentsConfigured() {
  return !!process.env.ROUTINE_FIRE_TOKEN;
}

export function newRunToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveRun(token, run) {
  // SET key value EX ttl — el valor va en el cuerpo para no tener límite de URL.
  const url = `${kvUrl()}/set/${encodeURIComponent(RUN_PREFIX + token)}?EX=${RUN_TTL_SECONDS}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(run),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV set run ${res.status}: ${await res.text()}`);
}

export async function getRun(token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
  const r = await kv(['get', RUN_PREFIX + token]);
  if (!r || r.result == null) return null;
  try { return typeof r.result === 'string' ? JSON.parse(r.result) : r.result; } catch (e) { return null; }
}

// Texto del manual (la página /manual sin etiquetas HTML). Es la fuente de
// verdad de los protocolos: si se cambia el manual, los agentes lo siguen.
export async function fetchManualText(origin) {
  const creds = (process.env.BASIC_AUTH_USERS || '').split(',')[0]?.trim()
    || (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? `${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASS}` : '');
  const headers = creds ? { Authorization: `Basic ${Buffer.from(creds).toString('base64')}` } : {};
  const res = await fetch(`${origin}/manual`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`manual ${res.status}`);
  const html = await res.text();
  const body = html.replace(/[\s\S]*?<body[^>]*>/i, '');
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(h[1-6]|p|li|div|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, 40000);
}

export async function fireRoutine(text) {
  const res = await fetch(fireUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ROUTINE_FIRE_TOKEN}`,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 65000) }),
  });
  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch (e) {}
  if (!res.ok) throw new Error(`Rutina ${res.status}: ${raw.slice(0, 300)}`);
  return data; // { claude_code_session_id, claude_code_session_url }
}

// ============ LANZAR AGENTES (botón y revisión automática) ============

const LOG_KEY = 'pipeline-agent-log';
const LOG_MAX = 3000;
const MAX_AGENT_CASES = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Qué hilos se mandan a los agentes: los que la IA marca como «te espera a
// ti» (ESPERA_JOAN) y los de «Espera mi respuesta» (mencionan a Joan y aún
// no ha contestado). Nunca privados, hechos ni archivados, y no se repiten
// en 20 h si no hay mensajes nuevos. Primero los ESPERA_JOAN, luego los más
// recientes.
// cases: [{ id, isDm, waitingForMe, lastMessageTs (segundos) }], stateCases: estado KV.
export function selectForAgents(cases, stateCases) {
  return cases.filter(c => {
    if (c.isDm) return false;
    const s = stateCases[c.id] || {};
    const st = s.status || 'todo';
    if (s.archived || st === 'done') return false;
    if (s.aiVerdict !== 'ESPERA_JOAN' && !c.waitingForMe) return false;
    if (s.agentAt) {
      const lastMsgMs = c.lastMessageTs ? parseFloat(c.lastMessageTs) * 1000 : 0;
      const recent = Date.now() - s.agentAt < 20 * 60 * 60 * 1000;
      if (recent && lastMsgMs <= s.agentAt) return false;
    }
    return true;
  }).sort((a, b) => {
    const ea = (stateCases[a.id] || {}).aiVerdict === 'ESPERA_JOAN' ? 1 : 0;
    const eb = (stateCases[b.id] || {}).aiVerdict === 'ESPERA_JOAN' ? 1 : 0;
    if (ea !== eb) return eb - ea;
    return (b.lastMessageTs || 0) - (a.lastMessageTs || 0);
  }).slice(0, MAX_AGENT_CASES);
}

// ¿El hilo ya tiene un borrador del agente que Joan no ha usado?
// Slack no deja cambiar un borrador ya creado (si se crea otro, se queda el
// viejo), así que en ese caso el agente solo actualiza la nota.
// Se da por usado si Joan ha escrito en el hilo después de crearse.
async function hasPendingDraft(c, s) {
  const draftAt = s.agentDraftAt || (s.agentStatus === 'draft' ? s.agentDoneAt : 0);
  if (!draftAt) return false;
  const myId = getMyUserId();
  try {
    const data = await slackFetch('conversations.replies', { channel: c.channelId, ts: c.ts, limit: 200 });
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const joanAfter = msgs.some(m => m.user === myId && parseFloat(m.ts) * 1000 > draftAt);
    return !joanAfter;
  } catch (e) {
    return true; // ante la duda, no crear otro borrador
  }
}

// cases: [{ channelId, ts, link, channelName, title }]. Devuelve { count, sessionUrl }.
export async function launchAgents(origin, rawCases, { source = 'botón' } = {}) {
  const cases = (Array.isArray(rawCases) ? rawCases : [])
    .filter(c => c && /^[CDG][A-Z0-9]+$/.test(c.channelId || '') && /^\d+\.\d+$/.test(c.ts || ''))
    .slice(0, MAX_AGENT_CASES)
    .map(c => ({
      caseId: `${c.channelId}-${c.ts}`,
      channelId: c.channelId,
      ts: c.ts,
      link: String(c.link || ''),
      channelName: String(c.channelName || ''),
      title: String(c.title || '').slice(0, 140),
    }));
  if (cases.length === 0) return { count: 0 };

  const state = (await getState()) || { cases: {} };
  const sc = state.cases || {};
  for (const c of cases) c.hasDraft = await hasPendingDraft(c, sc[c.caseId] || {});

  const token = newRunToken();
  let manual = '';
  try { manual = await fetchManualText(origin); } catch (e) { manual = '(No se pudo leer el manual: ' + String(e.message || e) + ')'; }
  let temas = [];
  try { temas = await recentTemas(); } catch (e) {}

  await saveRun(token, {
    caseIds: cases.map(c => c.caseId),
    cases: cases.map(c => ({ caseId: c.caseId, title: c.title, link: c.link, channelName: c.channelName })),
    createdAt: Date.now(),
    source,
  });

  const text = [
    `PASE: ${token}`,
    `URL_RESULTADOS: ${origin}/api/agents/result`,
    `FECHA: ${new Date().toISOString().slice(0, 10)}`,
    `ORIGEN: ${source}`,
    '',
    'HILOS:',
    ...cases.map((c, i) => `${i + 1}. caseId=${c.caseId} | canal=${c.channelId} (#${c.channelName}) | thread_ts=${c.ts} | enlace=${c.link} | ya_tiene_borrador=${c.hasDraft ? 'sí' : 'no'} | título: ${c.title}`),
    '',
    'TEMAS_YA_USADOS (reutiliza el mismo texto si el caso es igual):',
    ...(temas.length ? temas.map(t => `- ${t}`) : ['- (ninguno todavía)']),
    '',
    '=== MANUAL DEL PIPELINE (protocolos) ===',
    manual,
  ].join('\n');

  const fired = await fireRoutine(text);
  const now = Date.now();
  await applyPatches(cases.map(c => ({
    caseId: c.caseId,
    patch: { agentStatus: 'working', agentAt: now, agentNote: '', agentSessionUrl: fired.claude_code_session_url || '' },
  })));
  return { count: cases.length, sessionUrl: fired.claude_code_session_url || '' };
}

// ============ REGISTRO DE FICHAS (para «SOPs por enseñar») ============
export async function appendLog(entry) {
  const value = JSON.stringify(entry);
  const url = `${kvUrl()}/lpush/${encodeURIComponent(LOG_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken()}`, 'Content-Type': 'application/json' },
    body: value,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV lpush ${res.status}: ${await res.text()}`);
  await kv(['ltrim', LOG_KEY, '0', String(LOG_MAX - 1)]);
}

export async function readLog(days = 30) {
  const r = await kv(['lrange', LOG_KEY, '0', String(LOG_MAX - 1)]);
  const since = Date.now() - days * DAY_MS;
  return (Array.isArray(r.result) ? r.result : [])
    .map(x => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch (e) { return null; } })
    .filter(e => e && e.at >= since);
}

async function recentTemas() {
  const log = await readLog(30);
  const seen = new Map();
  for (const e of log) if (e.tema && !seen.has(e.tema.toLowerCase())) seen.set(e.tema.toLowerCase(), e.tema);
  return Array.from(seen.values()).slice(0, 40);
}

// Casos que se repiten y esperan a Joan (sin ficha o que dependen de él),
// del último mes, ordenados por veces. Un hilo cuenta una vez por tema.
export async function sopGroups(days = 30) {
  const log = await readLog(days);
  const groups = new Map();
  for (const e of log) { // el registro va del más nuevo al más viejo
    if (!(e.sinFicha || e.dependeJoan)) continue;
    const tema = String(e.tema || e.caso || 'Sin tema').trim();
    const key = tema.toLowerCase();
    if (!groups.has(key)) groups.set(key, { tema, count: 0, sinFicha: 0, dependeJoan: 0, cases: new Set(), ejemplos: [] });
    const g = groups.get(key);
    if (g.cases.has(e.caseId)) continue;
    g.cases.add(e.caseId);
    g.count++;
    if (e.sinFicha) g.sinFicha++;
    if (e.dependeJoan) g.dependeJoan++;
    if (g.ejemplos.length < 2) g.ejemplos.push({ title: e.title, link: e.link, porQue: e.porQue, at: e.at });
  }
  return Array.from(groups.values())
    .map(({ cases, ...g }) => g)
    .sort((a, b) => b.count - a.count);
}
