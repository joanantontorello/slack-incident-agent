import { NextResponse } from 'next/server';
import { slackFetch, hasUserToken, getMyUserId } from '../../lib/slack';
import { isKvEnabled, getDmSince, initDmSince } from '../../lib/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

// GET /api/dms → mensajes privados nuevos de Joan (DMs 1 a 1 y grupos
// privados) desde que se activó la función.
//
// - Usa el token de USUARIO (SLACK_USER_TOKEN): el bot no ve los privados.
// - Fecha de activación: se guarda en KV («pipeline-dm-since») la primera
//   vez que el panel consigue leer los privados. Sin KV → últimos 7 días.
// - Una conversación «espera respuesta» si el último mensaje escrito por una
//   persona (se ignoran bots y avisos del sistema) es de alguien que no es
//   MY_USER_ID. Si después contesta Joan, deja de esperar.
// - Nunca devuelve 500. Sin token o sin permisos →
//   { dms: [], error: 'missing_scope', needed: [...] } con status 200.
//
// Respuesta normal:
// { dms: [{ channel, type: 'im'|'mpim', userId, userName, members: [{id, name}],
//           lastText, lastTs, lastUserId, lastUserName, lastFromMe,
//           lastIncomingText, lastIncomingTs, lastIncomingUserId,
//           lastIncomingUserName, waiting, waitingSinceTs, link }],
//   since, sinceSource: 'kv'|'fallback-7d', teamId, checked, skipped, partial }

const NEEDED_SCOPES = ['im:read', 'im:history', 'mpim:read', 'mpim:history'];
const FALLBACK_TEAM_ID = 'T06R12QDUJD';
const FALLBACK_DAYS = 7;
const HISTORY_LIMIT = 20;            // mensajes recientes por conversación
const CONCURRENCY = 6;               // llamadas a Slack a la vez (como /api/thread)
const TEXT_MAX = 300;                // recorte del texto devuelto
const SCAN_BUDGET_MS = 40000;        // pasado este tiempo no se empiezan conversaciones nuevas
const RETRY_WAIT_MS = 2500;          // espera antes de reintentar si Slack pide frenar
const STALE_OK_MS = 30 * 60 * 1000;  // si una conversación no se puede leer, vale el dato de <30 min

// Errores de Slack que significan «el token falta, no vale o le faltan permisos».
const SCOPE_ERRORS = new Set([
  'missing_scope', 'not_allowed_token_type', 'no_permission',
  'not_authed', 'invalid_auth', 'token_revoked', 'token_expired', 'account_inactive',
]);

// Mensajes escritos por personas: sin subtipo, archivo compartido, respuesta
// de hilo enviada también al chat o /me. Fuera: bots, Slackbot y avisos.
const HUMAN_SUBTYPES = new Set(['thread_broadcast', 'file_share', 'me_message']);

// Cachés en memoria (por instancia de Vercel)
let cachedTeamId = null;
const userNameCache = new Map();     // userId → nombre
const mpimMembersCache = new Map();  // canal → [userIds] (en un grupo privado no cambian)
const lastKnown = new Map();         // canal → { at, since, result } último resultado bueno
let inflight = null;                 // peticiones simultáneas comparten el mismo barrido

function slackErrorCode(e) {
  const msg = String((e && e.message) || e || '');
  const m = msg.match(/ failed: ([a-z_]+)/);
  if (m) return m[1];
  if (/env var not configured/.test(msg)) return 'not_authed';
  return 'unexpected';
}

function errorDetail(e) {
  return String((e && e.message) || e || '').slice(0, 200);
}

function missingScope(detail) {
  return { dms: [], error: 'missing_scope', needed: NEEDED_SCOPES, detail };
}

// Ejecuta fn sobre items con como mucho `limit` a la vez. Con `deadline` o
// `stop()` deja de empezar elementos nuevos (los empezados terminan).
// Devuelve cuántos se llegaron a empezar (siempre los primeros de la lista).
async function mapLimit(items, limit, fn, { deadline = Infinity, stop = () => false } = {}) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      if (stop() || Date.now() > deadline) return;
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return cursor;
}

// Si Slack contesta «ratelimited», espera un poco y reintenta una vez.
async function withRetry(fn, deadline) {
  try {
    return await fn();
  } catch (e) {
    if (slackErrorCode(e) !== 'ratelimited' || Date.now() + RETRY_WAIT_MS > deadline) throw e;
    await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
    return fn();
  }
}

function isHumanMessage(m) {
  if (!m || !m.ts || !m.user) return false;
  if (m.bot_id || m.user === 'USLACKBOT') return false;
  return !m.subtype || HUMAN_SUBTYPES.has(m.subtype);
}

// Recorta sin dejar a medias una mención <@U…>, un enlace <…>, una entidad
// &amp; o un :emoji: (el panel los limpia después).
function trimSlackText(s, n) {
  const chars = Array.from(s);
  if (chars.length <= n) return s;
  const cut = chars.slice(0, n).join('')
    .replace(/<[^>]*$/, '')
    .replace(/&[a-z0-9#]*$/i, '')
    .replace(/:[a-z0-9_+-]*$/i, '');
  return cut.trimEnd() + '…';
}

function messageText(m) {
  const text = String(m.text || '').trim();
  if (text) return trimSlackText(text, TEXT_MAX);
  const files = Array.isArray(m.files) ? m.files.length : 0;
  if (files > 0) return files === 1 ? '📎 Archivo adjunto' : `📎 ${files} archivos adjuntos`;
  return '(mensaje sin texto)';
}

// Igual que /api/config: auth.test con el token del bot.
async function getTeamId() {
  if (cachedTeamId) return cachedTeamId;
  try {
    const data = await slackFetch('auth.test', {});
    if (data && data.team_id) {
      cachedTeamId = data.team_id;
      return cachedTeamId;
    }
  } catch (e) {}
  return FALLBACK_TEAM_ID;
}

// MY_USER_ID; si no está, el dueño del token de usuario.
async function getMyId() {
  const fromEnv = getMyUserId();
  if (fromEnv) return fromEnv;
  try {
    const data = await slackFetch('auth.test', {}, { useUserToken: true });
    return data.user_id || '';
  } catch (e) {
    return '';
  }
}

// Mismo criterio que /api/users (users.info con el bot y caché en memoria).
async function resolveNames(ids) {
  const out = {};
  const missing = [];
  for (const id of new Set(ids)) {
    if (!id) continue;
    if (userNameCache.has(id)) out[id] = userNameCache.get(id);
    else missing.push(id);
  }
  await mapLimit(missing, CONCURRENCY, async (id) => {
    try {
      const data = await slackFetch('users.info', { user: id });
      const name = data.user?.real_name || data.user?.profile?.display_name || data.user?.name || id;
      userNameCache.set(id, name);
      out[id] = name;
    } catch (e) {
      out[id] = id;
    }
  });
  return out;
}

async function listConversations() {
  const out = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const data = await slackFetch('conversations.list', {
      types: 'im,mpim',
      exclude_archived: true,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    }, { useUserToken: true });
    for (const c of (data.channels || [])) out.push(c);
    cursor = data?.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return out;
}

async function getMpimMembers(channel, myId) {
  if (mpimMembersCache.has(channel)) return mpimMembersCache.get(channel);
  try {
    const data = await slackFetch('conversations.members', { channel, limit: 100 }, { useUserToken: true });
    const ids = (Array.isArray(data.members) ? data.members : []).filter(id => id && id !== myId);
    mpimMembersCache.set(channel, ids);
    return ids;
  } catch (e) {
    return null;
  }
}

// Lee los últimos mensajes de una conversación desde la activación.
// Devuelve null si desde entonces no te ha escrito ninguna persona.
async function checkConversation(conv, since, myId) {
  const data = await slackFetch('conversations.history', {
    channel: conv.id,
    oldest: String(since),
    limit: HISTORY_LIMIT,
  }, { useUserToken: true });
  const humans = (Array.isArray(data.messages) ? data.messages : [])
    .filter(isHumanMessage)
    .sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts)); // más nuevo primero
  const incoming = humans.filter(m => m.user !== myId);
  if (incoming.length === 0) return null;

  const last = humans[0];
  const lastIncoming = incoming[0];
  const waiting = last.user !== myId;
  // Desde cuándo espera: primer mensaje de la racha sin contestar.
  let waitingSinceTs = null;
  if (waiting) {
    for (const m of humans) {
      if (m.user === myId) break;
      waitingSinceTs = m.ts;
    }
  }
  return {
    channel: conv.id,
    type: conv.is_mpim ? 'mpim' : 'im',
    otherUserId: conv.is_im ? conv.user : null,
    authorIds: Array.from(new Set(incoming.map(m => m.user))),
    lastTs: last.ts,
    lastUserId: last.user,
    lastFromMe: Boolean(myId) && last.user === myId,
    lastText: messageText(last),
    lastIncomingTs: lastIncoming.ts,
    lastIncomingUserId: lastIncoming.user,
    lastIncomingText: messageText(lastIncoming),
    waiting,
    waitingSinceTs,
  };
}

async function scan() {
  if (!hasUserToken()) return missingScope('no_user_token');

  // 1) Fecha de activación
  const now = Math.floor(Date.now() / 1000);
  let since = now - FALLBACK_DAYS * 86400;
  let sinceSource = 'fallback-7d';
  let saveSince = false;
  if (isKvEnabled()) {
    try {
      const stored = await getDmSince();
      sinceSource = 'kv';
      if (stored) {
        since = stored;
      } else {
        since = now; // primera vez: solo lo que llegue a partir de ahora
        saveSince = true;
      }
    } catch (e) {
      // KV no responde → seguimos con los últimos 7 días.
      since = now - FALLBACK_DAYS * 86400;
      sinceSource = 'fallback-7d';
    }
  }

  // 2) Lista de conversaciones privadas
  let convs;
  try {
    convs = await listConversations();
  } catch (e) {
    const code = slackErrorCode(e);
    if (SCOPE_ERRORS.has(code)) return missingScope(code);
    return { dms: [], error: code, detail: errorDetail(e) };
  }

  const myId = await getMyId();
  const candidates = convs.filter(c => {
    if (!c || !c.id || c.is_archived) return false;
    if (c.is_im) return Boolean(c.user) && c.user !== myId && c.user !== 'USLACKBOT' && !c.is_user_deleted;
    return Boolean(c.is_mpim);
  });

  // 3) Historial reciente de cada una, con concurrencia limitada
  const deadline = Date.now() + SCAN_BUDGET_MS;
  let scopeError = null;
  let checked = 0;
  let skipped = 0;
  const found = [];
  const useLastKnown = (conv) => {
    const prev = lastKnown.get(conv.id);
    if (prev && prev.since === since && Date.now() - prev.at < STALE_OK_MS) {
      if (prev.result) found.push(prev.result);
      return true;
    }
    return false;
  };

  const started = await mapLimit(candidates, CONCURRENCY, async (conv) => {
    try {
      const result = await withRetry(() => checkConversation(conv, since, myId), deadline);
      checked++;
      lastKnown.set(conv.id, { at: Date.now(), since, result });
      if (result) found.push(result);
    } catch (e) {
      const code = slackErrorCode(e);
      if (SCOPE_ERRORS.has(code)) {
        scopeError = scopeError || code;
        return;
      }
      if (!useLastKnown(conv)) skipped++;
    }
  }, { deadline, stop: () => Boolean(scopeError) });

  if (scopeError) return missingScope(scopeError);

  // Las que no dio tiempo a mirar: último dato conocido, si lo hay.
  for (const conv of candidates.slice(started)) {
    if (!useLastKnown(conv)) skipped++;
  }

  // 4) Primera lectura buena → se fija la fecha de activación en KV
  if (saveSince && (checked > 0 || candidates.length === 0)) {
    try { await initDmSince(since); } catch (e) {}
  }

  // 5) Miembros de los grupos y nombres
  const mpimMembers = new Map();
  await mapLimit(found.filter(d => d.type === 'mpim'), CONCURRENCY, async (d) => {
    const ids = await getMpimMembers(d.channel, myId);
    mpimMembers.set(d.channel, ids && ids.length > 0 ? ids : d.authorIds);
  });
  const memberIdsOf = (d) => (d.type === 'mpim' ? (mpimMembers.get(d.channel) || d.authorIds) : [d.otherUserId]);
  const ids = [];
  for (const d of found) {
    ids.push(...memberIdsOf(d), d.lastUserId, d.lastIncomingUserId);
  }
  const names = await resolveNames(ids.filter(Boolean));
  const nameOf = (id) => names[id] || id;

  // 6) Respuesta
  const teamId = await getTeamId();
  const dms = found.map(d => {
    const userId = d.type === 'im' ? d.otherUserId : d.lastIncomingUserId;
    return {
      channel: d.channel,
      type: d.type,
      userId,
      userName: nameOf(userId),
      members: memberIdsOf(d).filter(Boolean).map(id => ({ id, name: nameOf(id) })),
      lastText: d.lastText,
      lastTs: d.lastTs,
      lastUserId: d.lastUserId,
      lastUserName: nameOf(d.lastUserId),
      lastFromMe: d.lastFromMe,
      lastIncomingText: d.lastIncomingText,
      lastIncomingTs: d.lastIncomingTs,
      lastIncomingUserId: d.lastIncomingUserId,
      lastIncomingUserName: nameOf(d.lastIncomingUserId),
      waiting: d.waiting,
      waitingSinceTs: d.waitingSinceTs,
      link: `https://app.slack.com/client/${teamId}/${d.channel}`,
    };
  }).sort((a, b) => parseFloat(b.lastTs) - parseFloat(a.lastTs));

  return { dms, since, sinceSource, teamId, checked, skipped, partial: skipped > 0 };
}

export async function GET() {
  if (!inflight) {
    inflight = scan()
      .catch(e => ({ dms: [], error: 'unexpected', detail: errorDetail(e) }))
      .finally(() => { inflight = null; });
  }
  const body = await inflight;
  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
