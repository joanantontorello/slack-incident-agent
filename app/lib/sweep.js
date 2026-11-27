// Revisión automática: hace en el servidor lo mismo que el botón
// «✨ Revisar con IA» del panel (lee los hilos, los clasifica, mueve a Hecho
// los resueltos y manda a los agentes los que esperan a Joan).
// La llama Vercel Cron de lunes a viernes a las 16:00 (hora de Madrid).
import { slackFetch, getActiveChannels, getMyUserId, getAutoDoneUserIds, hasUserToken } from './slack';
import { getState, applyPatches } from './kv';
import { analyzeMany } from './classify';
import { isAgentsConfigured, selectForAgents, launchAgents } from './agents';

const DAYS = 14;
const DONE_EMOJIS = ['white_check_mark', 'white_tick', 'ballot_box_with_check', 'heavy_check_mark', 'check', 'check_mark', 'green_check_mark', 'greentick', 'green_tick', 'tick'];

async function pool(items, conc, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, worker));
  return out;
}

function plainTitle(text) {
  const s = String(text || '')
    .replace(/<@[A-Z0-9]+(\|[^>]+)?>/g, '')
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/:[a-z0-9_+-]+:/g, '')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
  return s.length > 60 ? s.slice(0, 59) + '…' : s;
}

async function replies(channel, ts) {
  try {
    const d = await slackFetch('conversations.replies', { channel, ts, limit: 200 });
    return Array.isArray(d.messages) ? d.messages : [];
  } catch (e) { return []; }
}

function buildCase(channelId, ts, msgs, { myId, autoDoneIds, teamUrl, filter, rootFallback }) {
  const root = msgs[0] || rootFallback || {};
  const rootText = String(root.text || '');
  const reps = msgs.slice(1);
  const allText = rootText + ' ' + reps.map(r => String(r.text || '')).join(' ');
  if (filter === 'mention' && (!myId || !allText.includes(myId))) return null;
  const lastMsg = reps.length ? reps[reps.length - 1] : root;
  // Igual que el panel: ¿espera respuesta de Joan?
  const lastUserId = lastMsg.user || root.user || '';
  const waitingForMe = !!myId && (reps.length === 0
    ? rootText.includes(myId) && root.user !== myId
    : lastUserId !== myId && allText.includes(myId));
  const reactions = Array.isArray(root.reactions) ? root.reactions : [];
  const checkedByMe = autoDoneIds.length > 0 && reactions.some(r =>
    r && DONE_EMOJIS.includes(r.name) && Array.isArray(r.users) && r.users.some(u => autoDoneIds.includes(u)));
  return {
    id: `${channelId}-${ts}`,
    channelId, ts,
    lastMessageTs: parseFloat(lastMsg.ts || ts),
    title: plainTitle(rootText) || '(sin título)',
    link: teamUrl ? `${teamUrl.replace(/\/$/, '')}/archives/${channelId}/p${String(ts).replace('.', '')}` : '',
    checkedByMe,
    waitingForMe,
    lastTs: lastMsg.ts || ts,
  };
}

// Pone ✅ (y quita 👀 si estaba en curso) y marca el hilo como leído, igual
// que cuando el panel mueve una tarjeta a Hecho.
async function reactDone(c, fromStatus) {
  const asUser = hasUserToken();
  const opts = { useUserToken: asUser };
  try { await slackFetch('reactions.add', { channel: c.channelId, timestamp: c.ts, name: 'white_check_mark' }, opts); } catch (e) {}
  if (fromStatus === 'doing') {
    try { await slackFetch('reactions.remove', { channel: c.channelId, timestamp: c.ts, name: 'eyes' }, opts); } catch (e) {}
  }
  if (asUser) {
    try { await slackFetch('conversations.mark', { channel: c.channelId, ts: c.lastTs }, { useUserToken: true }); } catch (e) {}
  }
}

export async function runSweep(origin, { dry = false } = {}) {
  const started = Date.now();
  const myId = getMyUserId();
  const autoDoneIds = getAutoDoneUserIds();
  let teamUrl = '';
  try { teamUrl = (await slackFetch('auth.test', {})).url || ''; } catch (e) {}
  const channels = await getActiveChannels();
  const names = {};
  await pool(channels, 4, async ch => {
    try { names[ch.id] = (await slackFetch('conversations.info', { channel: ch.id })).channel?.name || ch.id; } catch (e) { names[ch.id] = ch.id; }
  });

  // 1. Hilos de los últimos 14 días (mismo criterio que el panel)
  const oldest = Math.floor(Date.now() / 1000 - DAYS * 86400);
  const fetches = [];
  await pool(channels, 4, async ch => {
    let msgs = [];
    try { msgs = (await slackFetch('conversations.history', { channel: ch.id, oldest: String(oldest), limit: 100 })).messages || []; } catch (e) {}
    for (const m of msgs) {
      const mentionsMe = myId && m.text && m.text.includes(myId);
      const ok = ch.filter === 'mention' ? (m.reply_count > 0 || mentionsMe || m.user === myId) : m.reply_count > 0;
      if (ok) fetches.push({ channel: ch.id, ts: m.ts, root: m, filter: ch.filter || 'all' });
    }
  });
  const ctx = { myId, autoDoneIds, teamUrl };
  const built = (await pool(fetches, 6, async f =>
    buildCase(f.channel, f.ts, await replies(f.channel, f.ts), { ...ctx, filter: f.filter, rootFallback: f.root })
  )).filter(Boolean);

  // 2. Tarjetas pendientes más antiguas que siguen en el panel
  let state = (await getState()) || { cases: {} };
  let sc = state.cases || {};
  const builtIds = new Set(built.map(c => c.id));
  const toRecover = Object.entries(sc).filter(([id, s]) =>
    !builtIds.has(id) && !id.startsWith('dm:') && !s.archived && ['todo', 'doing'].includes(s.status || 'todo'));
  const recovered = (await pool(toRecover, 6, async ([id]) => {
    const sep = id.indexOf('-');
    const channel = id.slice(0, sep), ts = id.slice(sep + 1);
    const msgs = await replies(channel, ts);
    return msgs.length ? buildCase(channel, ts, msgs, { ...ctx, filter: 'all' }) : null;
  })).filter(Boolean);
  const cases = [...built, ...recovered];

  const pending = cases.filter(c => {
    const s = sc[c.id] || {};
    return !c.checkedByMe && !s.archived && ['todo', 'doing'].includes(s.status || 'todo');
  });
  if (dry) {
    return { dry: true, threads: cases.length, pending: pending.length, agentsConfigured: isAgentsConfigured(), ms: Date.now() - started };
  }

  // 3. Los que Joan ya marcó con ✅ en Slack → Hecho
  const donePatches = cases.filter(c => c.checkedByMe && (sc[c.id] || {}).status !== 'done')
    .map(c => ({ caseId: c.id, patch: { status: 'done', doneAt: (sc[c.id] || {}).doneAt || Date.now(), autoFromSlack: true } }));
  if (donePatches.length) await applyPatches(donePatches);

  // 4. Clasificar con IA los pendientes
  let classified = 0, autoMoved = 0, errors = 0;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && pending.length) {
    const results = await analyzeMany(apiKey, pending.map(c => ({ channelId: c.channelId, ts: c.ts })));
    const patches = [];
    const reacts = [];
    for (const r of results) {
      if (!r || r.error) { errors++; continue; }
      const caseId = `${r.channelId}-${r.ts}`;
      const c = pending.find(x => x.id === caseId);
      const patch = { aiVerdict: r.verdict, aiConfidence: r.confidence, aiReason: r.reason, aiAnalyzedAt: Date.now() };
      if (r.verdict === 'RESUELTO' && (r.confidence === 'high' || r.confidence === 'medium') && c) {
        patch.status = 'done';
        patch.doneAt = Date.now();
        patch.lastViewedTs = c.lastMessageTs;
        reacts.push([c, (sc[caseId] || {}).status || 'todo']);
        autoMoved++;
      }
      patches.push({ caseId, patch });
      classified++;
    }
    if (patches.length) await applyPatches(patches);
    await pool(reacts, 3, ([c, from]) => reactDone(c, from));
  }

  // 5. Agentes para los que esperan a Joan
  let agents = 0, agentError = '';
  if (isAgentsConfigured()) {
    state = (await getState()) || { cases: {} };
    sc = state.cases || {};
    const toAgents = selectForAgents(cases, sc);
    if (toAgents.length) {
      try {
        const r = await launchAgents(origin, toAgents.map(c => ({
          channelId: c.channelId, ts: c.ts, link: c.link, channelName: names[c.channelId] || c.channelId, title: c.title,
        })), { source: 'revisión automática' });
        agents = r.count || 0;
      } catch (e) { agentError = String(e.message || e).slice(0, 200); }
    }
  } else {
    agentError = 'not_configured';
  }

  return {
    at: Date.now(), threads: cases.length, pending: pending.length, classified, autoMoved,
    slackDone: donePatches.length, errors, agents, agentError, ms: Date.now() - started,
  };
}
