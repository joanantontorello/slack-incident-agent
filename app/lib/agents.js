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
