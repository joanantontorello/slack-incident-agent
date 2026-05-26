'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'pipeline_incidencias_v1';

// Emojis Slack más usados → unicode. Para los que no estén, se deja `:name:`.
const EMOJI_MAP = {
  '+1': '👍', '-1': '👎', thumbsup: '👍', thumbsdown: '👎', ok_hand: '👌',
  wave: '👋', clap: '👏', pray: '🙏', muscle: '💪', point_up: '☝️', point_down: '👇',
  point_right: '👉', point_left: '👈', raised_hands: '🙌',
  white_check_mark: '✅', heavy_check_mark: '✔️', check: '✅', ballot_box_with_check: '☑️',
  x: '❌', negative_squared_cross_mark: '❎', warning: '⚠️', no_entry: '⛔', no_entry_sign: '🚫',
  fire: '🔥', sparkles: '✨', star: '⭐', star2: '🌟', boom: '💥', zap: '⚡',
  eyes: '👀', thinking_face: '🤔', face_with_monocle: '🧐', scream: '😱', sunglasses: '😎',
  smile: '😄', smiley: '😃', grin: '😁', laughing: '😆', joy: '😂', rofl: '🤣',
  slightly_smiling_face: '🙂', wink: '😉', heart_eyes: '😍', kissing_heart: '😘',
  blush: '😊', innocent: '😇', cry: '😢', sob: '😭', sweat: '😓', sweat_smile: '😅',
  disappointed: '😞', confused: '😕', neutral_face: '😐', expressionless: '😑',
  tada: '🎉', confetti_ball: '🎊', rocket: '🚀', bulb: '💡', mag: '🔍', mag_right: '🔎',
  bell: '🔔', no_bell: '🔕', calendar: '📅', date: '📆', clock1: '🕐', alarm_clock: '⏰',
  phone: '📞', telephone_receiver: '📞', email: '📧', envelope: '✉️', love_letter: '💌',
  moneybag: '💰', money_with_wings: '💸', dollar: '💵', euro: '💶', credit_card: '💳',
  chart_with_upwards_trend: '📈', chart_with_downwards_trend: '📉', bar_chart: '📊',
  heart: '❤️', broken_heart: '💔', orange_heart: '🧡', yellow_heart: '💛',
  green_heart: '💚', blue_heart: '💙', purple_heart: '💜', black_heart: '🖤',
  question: '❓', exclamation: '❗', grey_question: '❔', grey_exclamation: '❕',
  pushpin: '📌', round_pushpin: '📍', paperclip: '📎', link: '🔗', lock: '🔒', unlock: '🔓', key: '🔑',
  white_circle: '⚪', black_circle: '⚫', red_circle: '🔴', large_blue_circle: '🔵',
  large_orange_circle: '🟠', large_yellow_circle: '🟡', large_green_circle: '🟢', large_purple_circle: '🟣',
  arrow_right: '➡️', arrow_left: '⬅️', arrow_up: '⬆️', arrow_down: '⬇️',
  arrow_up_small: '🔼', arrow_down_small: '🔽', back: '🔙', soon: '🔜',
  hourglass: '⌛', hourglass_flowing_sand: '⏳', stopwatch: '⏱️',
  raising_hand: '🙋', man_raising_hand: '🙋‍♂️', woman_raising_hand: '🙋‍♀️',
  bow: '🙇', man_bowing: '🙇‍♂️', woman_bowing: '🙇‍♀️',
  handshake: '🤝', writing_hand: '✍️', speech_balloon: '💬', thought_balloon: '💭',
  hammer: '🔨', wrench: '🔧', gear: '⚙️', construction: '🚧',
  computer: '💻', desktop_computer: '🖥️', iphone: '📱', headphones: '🎧',
  page_facing_up: '📄', page_with_curl: '📃', clipboard: '📋', notebook: '📓', books: '📚',
  memo: '📝', pencil: '✏️', pencil2: '✏️', closed_book: '📕', green_book: '📗', blue_book: '📘',
  package: '📦', gift: '🎁', shopping_cart: '🛒', truck: '🚚',
  trophy: '🏆', medal: '🏅', '100': '💯', first_place_medal: '🥇',
  hand: '✋', wave_tone: '👋', skin: '👌',
};

// ============ HELPERS ============
function loadState() {
  if (typeof window === 'undefined') return { cases: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { cases: {} };
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

function categorize(text) {
  const t = (text || '').toLowerCase();
  if (/(quitar?\s+acces|pausar?\s+acces|revocar|dar de baja|baja del programa|cuota atrasada)/i.test(t)) {
    return { key: 'acceso', label: '🔴 Acceso', cls: 'badge-acceso' };
  }
  if (/(reembols|devoluci|devolver|cobro\s+incorrecto)/i.test(t)) {
    return { key: 'reembolso', label: '💰 Reembolso', cls: 'badge-reembolso' };
  }
  return { key: 'otro', label: '📌 Otro', cls: 'badge-otro' };
}

function ageFromTs(ts) {
  const now = Date.now() / 1000;
  const diff = now - parseFloat(ts);
  if (diff < 3600) return { text: `hace ${Math.round(diff/60)}min`, cls: 'age-fresh' };
  if (diff < 86400) return { text: `hace ${Math.round(diff/3600)}h`, cls: 'age-fresh' };
  const days = Math.round(diff/86400);
  if (days < 3) return { text: `hace ${days}d`, cls: 'age-medium' };
  return { text: `hace ${days}d`, cls: 'age-old' };
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function shortenText(s, n, users) {
  if (!s) return '';
  s = decodeEntities(s)
       .replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1')
       .replace(/<tel:[^|>]+\|([^>]+)>/g, '$1')
       .replace(/<@[^|>]+\|([^>]+)>/g, '@$1')
       .replace(/<@([A-Z0-9]+)>/g, (m, id) => users && users[id] ? '@' + users[id] : '')
       .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
       .replace(/<!channel>/g, '@channel')
       .replace(/<!here>/g, '@here')
       .replace(/<((https?:[^|>]+))\|([^>]+)>/g, '$3')
       .replace(/<(https?:[^>]+)>/g, '$1')
       .replace(/:([a-z0-9_+-]+):/g, (m, name) => EMOJI_MAP[name] || m)
       .replace(/\s+/g, ' ')
       .trim();
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function extractTitle(text, users) {
  const cleaned = shortenText(text, 200, users);
  const lines = cleaned.split(/\n|—|\*/).filter(l => l.trim().length > 3);
  return lines.length > 0 ? shortenText(lines[0], 90, users) : shortenText(cleaned, 90, users);
}

function buildSlackLink(channelId, ts, teamUrl) {
  // Prefer direct workspace URL (opens thread correctly):
  // https://{workspace}.slack.com/archives/{channel}/p{ts_no_dot}
  if (teamUrl) {
    const base = teamUrl.replace(/\/$/, '');
    const tsNoDot = String(ts).replace('.', '');
    return `${base}/archives/${channelId}/p${tsNoDot}`;
  }
  // Fallback (less reliable for threads):
  return `https://slack.com/app_redirect?channel=${channelId}&message_ts=${ts}`;
}

// slack:// deep link → abre directamente la app de Slack sin la página
// intermedia "Launching..." y sin acumular pestañas en el navegador.
function buildSlackDeepLink(channelId, ts, teamId) {
  if (!teamId) return null;
  return `slack://channel?team=${teamId}&id=${channelId}&message=${ts}`;
}

// Convierte texto Slack en array de React nodes con menciones, links,
// emojis y entidades HTML resueltas. Para el modal (preserva saltos).
function formatSlackText(s, users) {
  if (!s) return '';
  const text = decodeEntities(s);
  const TOKEN_RE = /<@([A-Z0-9]+)(?:\|([^>]+))?>|<#([A-Z0-9]+)(?:\|([^>]+))?>|<!(channel|here|everyone)>|<mailto:([^|>]+)(?:\|([^>]+))?>|<(https?:[^|>]+)(?:\|([^>]+))?>|:([a-z0-9_+-]+):/g;
  const out = [];
  let last = 0;
  let m;
  let key = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, userId, userLabel, chId, chLabel, broadcast, mail, mailLabel, url, urlLabel, emojiName] = m;
    if (userId) {
      const name = userLabel || (users && users[userId]) || userId;
      out.push(<span key={key++} className="mention">@{name}</span>);
    } else if (chId) {
      out.push(<span key={key++} className="mention">#{chLabel || chId}</span>);
    } else if (broadcast) {
      out.push(<span key={key++} className="mention">@{broadcast}</span>);
    } else if (mail) {
      out.push(<a key={key++} href={`mailto:${mail}`} className="link">{mailLabel || mail}</a>);
    } else if (url) {
      out.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="link">{urlLabel || url}</a>);
    } else if (emojiName) {
      out.push(EMOJI_MAP[emojiName] || `:${emojiName}:`);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Hash determinista user_id → color de la paleta (para diferenciar autores).
const AUTHOR_PALETTE = ['#7c3aed', '#0891b2', '#ea580c', '#db2777', '#0d9488', '#ca8a04', '#4338ca', '#9333ea', '#e11d48', '#16a34a', '#2563eb', '#b45309'];
function colorForUser(id) {
  if (!id) return '#6b7280';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AUTHOR_PALETTE[h % AUTHOR_PALETTE.length];
}

function formatTs(ts) {
  const d = new Date(parseFloat(ts) * 1000);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ============ MAIN COMPONENT ============
export default function Page() {
  const [cases, setCases] = useState([]);
  const [state, setState] = useState({ cases: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [config, setConfig] = useState({ myUserId: '', channels: [], team: null });
  const [progress, setProgress] = useState('');
  const [modalCase, setModalCase] = useState(null);
  const [modalMessages, setModalMessages] = useState([]);
  const [modalUsers, setModalUsers] = useState({});
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { setState(loadState()); }, []);

  const channelLabel = useCallback((id) => {
    const map = {
      'C0A0W5N0LUC': 'incidencias-pagos',
      'C097D0JTL48': 'administración',
      'C096QADCNMQ': 'general',
    };
    if (!id) return 'canal';
    return map[id] || String(id).slice(-4);
  }, []);

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t && Date.now() - t.id >= 4500) ? null : t), 5000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress('Leyendo canales…');
    try {
      const cfgRes = await fetch('/api/config').then(r => r.json());
      setConfig(cfgRes);
      const myId = cfgRes.myUserId;

      const msgsRes = await fetch('/api/messages?days=14').then(r => r.json());
      if (msgsRes.error) throw new Error(msgsRes.error);

      // Gather all user IDs to resolve names
      const userIdsToResolve = new Set();
      (msgsRes.channels || []).forEach(c => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        msgs.forEach(m => { if (m && m.user) userIdsToResolve.add(m.user); });
      });

      // Identify candidate threads (with replies, or for "mention" channel: any message mentioning me)
      // API devuelve `channel` (no `id`).
      const threadFetches = [];
      for (const c of msgsRes.channels) {
        const channelId = c.channel || c.id;
        const filter = c.filter || 'all';
        const messages = Array.isArray(c.messages) ? c.messages : [];
        for (const m of messages) {
          const mentionsMe = myId && m.text && m.text.includes(myId);
          const isFromMe = m.user === myId;
          if (filter === 'mention') {
            if (m.reply_count > 0 || mentionsMe || isFromMe) {
              threadFetches.push({ channel: channelId, ts: m.ts, root: m, channelFilter: filter });
            }
          } else if (m.reply_count > 0) {
            threadFetches.push({ channel: channelId, ts: m.ts, root: m, channelFilter: filter });
          }
        }
      }

      setProgress(`Leyendo ${threadFetches.length} hilos…`);

      // Fetch threads with concurrency limit
      const CONCURRENCY = 6;
      const threadResults = new Array(threadFetches.length);
      let cursor = 0;
      async function worker() {
        while (cursor < threadFetches.length) {
          const i = cursor++;
          const f = threadFetches[i];
          try {
            const r = await fetch(`/api/thread?channel=${f.channel}&ts=${f.ts}`).then(r => r.json());
            threadResults[i] = { f, messages: r.messages || [] };
            (r.messages || []).forEach(m => { if (m.user) userIdsToResolve.add(m.user); });
          } catch (e) {
            threadResults[i] = { f, messages: [], error: e.message };
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      // Resolve user names
      setProgress('Resolviendo usuarios…');
      const ids = Array.from(userIdsToResolve).join(',');
      let users = {};
      if (ids) {
        try {
          const ur = await fetch(`/api/users?ids=${ids}`).then(r => r.json());
          users = ur.users || {};
        } catch (e) {}
      }

      // Build cases (defensive)
      const allCases = [];
      for (const tr of threadResults) {
        try {
          if (!tr) continue;
          const { f, messages } = tr;
          if (!f) continue;
          const msgs = Array.isArray(messages) ? messages : [];
          const root = msgs[0] || f.root || {};
          const rootText = String(root.text || '');
          const rootUser = root.user || '';
          const replies = msgs.slice(1);
          const repliesText = replies.map(r => String((r && r.text) || '')).join(' ');
          const allText = rootText + ' ' + repliesText;

          // For "mention" channel, only include if me is mentioned anywhere
          if (f.channelFilter === 'mention') {
            if (!myId || !allText.includes(myId)) continue;
          }

          const lastMsg = replies.length > 0 ? (replies[replies.length - 1] || {}) : root;
          const lastUserId = lastMsg.user || rootUser;
          const lastText = String(lastMsg.text || rootText);

          const waitingForMe = (() => {
            if (!myId) return false;
            if (replies.length === 0) {
              return rootText.includes(myId) && rootUser !== myId;
            }
            if (lastUserId === myId) return false;
            return allText.includes(myId);
          })();

          // ¿Joan reaccionó con ✅ al mensaje raíz? → considerar Hecho.
          const rootReactions = Array.isArray(root.reactions) ? root.reactions : [];
          const checkedByMe = myId && rootReactions.some(r =>
            r && r.name === 'white_check_mark' && Array.isArray(r.users) && r.users.includes(myId)
          );

          allCases.push({
            id: `${f.channel}-${f.ts}`,
            channelId: f.channel,
            ts: f.ts,
            title: extractTitle(rootText, users) || '(sin título)',
            summary: shortenText(rootText, 180, users),
            lastUser: users[lastUserId] || lastUserId || 'desconocido',
            lastText: shortenText(lastText, 150, users),
            category: categorize(allText),
            waitingForMe,
            checkedByMe,
            link: buildSlackLink(f.channel, f.ts, cfgRes?.team?.url),
            deepLink: buildSlackDeepLink(f.channel, f.ts, cfgRes?.team?.team_id),
            replyCount: replies.length,
          });
        } catch (err) {
          console.error('Error procesando hilo', tr && tr.f, err);
        }
      }

      setCases(allCases);

      // Auto-promoción a "done" en localStorage para todos los hilos en los
      // que Joan ya reaccionó con ✅ en Slack (única fuente de verdad).
      const current = loadState();
      const nextCases = { ...current.cases };
      let promoted = 0;
      for (const c of allCases) {
        if (!c.checkedByMe) continue;
        const prev = nextCases[c.id] || {};
        if (prev.status !== 'done') {
          nextCases[c.id] = { ...prev, status: 'done', doneAt: prev.doneAt || Date.now(), autoFromSlack: true };
          promoted++;
        }
      }
      if (promoted > 0) {
        const ns = { ...current, cases: nextCases };
        setState(ns); saveState(ns);
        showToast(`✅ ${promoted} ${promoted === 1 ? 'hilo movido' : 'hilos movidos'} a Hecho (reacción ✅ en Slack)`, 'ok');
      }

      setLoading(false);
      setProgress('');
    } catch (e) {
      setError(e.message || String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openModal = useCallback(async (c) => {
    setModalCase(c);
    setModalLoading(true);
    setModalMessages([]);
    setModalUsers({});
    try {
      const r = await fetch(`/api/thread?channel=${c.channelId}&ts=${c.ts}`).then(r => r.json());
      const msgs = Array.isArray(r.messages) ? r.messages : [];
      setModalMessages(msgs);
      const ids = Array.from(new Set(msgs.map(m => m && m.user).filter(Boolean))).join(',');
      if (ids) {
        const ur = await fetch(`/api/users?ids=${ids}`).then(r => r.json());
        setModalUsers(ur.users || {});
      }
    } catch (e) {
      // silent
    }
    setModalLoading(false);
  }, []);
  const closeModal = useCallback(() => setModalCase(null), []);

  useEffect(() => {
    if (!modalCase) return;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalCase, closeModal]);

  const syncSlackDone = useCallback(async (c, undo = false) => {
    if (!c || !c.channelId || !c.ts) return;
    try {
      const res = await fetch('/api/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: c.channelId, ts: c.ts, undo }),
      });
      const data = await res.json().catch(() => ({}));
      const reaction = data.reaction;
      const mark = data.mark;
      const as = data.reactionAs || '?';
      const reactionOK = reaction === 'ok' || reaction === 'noop';
      const markOK = mark === 'ok' || (mark && mark.startsWith('skipped'));
      if (reactionOK && markOK) {
        showToast(undo ? `↩ Reacción quitada en Slack (como ${as})` : `✅ Marcado en Slack (como ${as})`, 'ok');
      } else {
        const parts = [`as=${as}`];
        if (!reactionOK) parts.push(`reacción: ${reaction || 'sin respuesta'}`);
        if (!markOK)     parts.push(`mark: ${mark}`);
        showToast(`⚠️ Sync parcial → ${parts.join(' · ')}`, 'warn');
      }
    } catch (e) {
      showToast(`❌ Sync falló: ${e.message || e}`, 'err');
    }
  }, [showToast]);

  const setCaseStatus = (caseId, status) => {
    const prev = state.cases[caseId] || {};
    const s = { ...state, cases: { ...state.cases, [caseId]: { ...prev, status, ...(status === 'done' ? { doneAt: Date.now() } : {}) } } };
    setState(s); saveState(s);
    // Sync con Slack al pasar a/desde "done"
    const c = cases.find(x => x.id === caseId);
    if (c) {
      if (status === 'done' && prev.status !== 'done') syncSlackDone(c, false);
      else if (status !== 'done' && prev.status === 'done') syncSlackDone(c, true);
    }
  };

  const archiveAllDone = () => {
    const doneIds = cases
      .filter(c => (state.cases[c.id]?.status || 'todo') === 'done' && !state.cases[c.id]?.archived)
      .map(c => c.id);
    if (doneIds.length === 0) return;
    if (!confirm(`¿Archivar ${doneIds.length} ${doneIds.length === 1 ? 'tarjeta' : 'tarjetas'} de Hecho?`)) return;
    const next = { ...state.cases };
    for (const id of doneIds) {
      next[id] = { ...(next[id] || {}), archived: true };
    }
    const s = { ...state, cases: next };
    setState(s); saveState(s);
  };
  const archiveCase = (caseId) => {
    const s = { ...state, cases: { ...state.cases, [caseId]: { ...(state.cases[caseId] || {}), archived: true } } };
    setState(s); saveState(s);
  };
  const restoreCase = (caseId) => {
    const s = { ...state, cases: { ...state.cases, [caseId]: { ...(state.cases[caseId] || {}), archived: false, status: 'todo' } } };
    setState(s); saveState(s);
  };

  // Filter and bucket
  const filtered = cases.filter(c =>
    (activeFilter === 'all' || c.channelId === activeFilter) &&
    (activeCategory === 'all' || c.category.key === activeCategory)
  );
  const categoryCounts = cases
    .filter(c => activeFilter === 'all' || c.channelId === activeFilter)
    .reduce((acc, c) => { acc[c.category.key] = (acc[c.category.key] || 0) + 1; return acc; }, {});
  const buckets = { todo: [], doing: [], done: [] };
  const archived = [];
  for (const c of filtered) {
    const s = state.cases[c.id] || {};
    if (s.archived) { archived.push(c); continue; }
    const status = s.status || 'todo';
    buckets[status].push(c);
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => {
      if (a.waitingForMe !== b.waitingForMe) return b.waitingForMe - a.waitingForMe;
      return parseFloat(a.ts) - parseFloat(b.ts);
    });
  }
  const waitingCount = filtered.filter(c => c.waitingForMe && (state.cases[c.id]?.status || 'todo') === 'todo').length;

  return (
    <>
      <style jsx global>{`
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; background: #f8f9fb; color: #1a1a1a; font-size: 13px; line-height: 1.4; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; gap: 12px; flex-wrap: wrap; }
        .header h1 { margin: 0; font-size: 15px; font-weight: 600; }
        .header .stats { display: flex; gap: 14px; font-size: 12px; color: #555; flex-wrap: wrap; }
        .header .stats b { color: #111; font-weight: 600; }
        .channel-filter { display: flex; gap: 6px; flex-wrap: wrap; }
        .channel-filter button { background: #fff; border: 1px solid #d1d5db; border-radius: 14px; padding: 3px 10px; font-size: 11px; cursor: pointer; color: #444; }
        .channel-filter button.active { background: #4f46e5; color: white; border-color: #4f46e5; }
        .filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
        .filter-row .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
        .filter-row button { background: #fff; border: 1px solid #d1d5db; border-radius: 14px; padding: 3px 10px; font-size: 11px; cursor: pointer; color: #444; }
        .filter-row button.active { background: #111; color: white; border-color: #111; }
        .filter-row button .count { color: inherit; opacity: 0.7; margin-left: 4px; font-size: 10px; }
        .refresh-btn { background: #4f46e5; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
        .refresh-btn:disabled { opacity: 0.5; cursor: wait; }
        .board { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 12px; min-height: calc(100vh - 60px); }
        @media (max-width: 800px) { .board { grid-template-columns: 1fr; } }
        .col { border-radius: 10px; padding: 8px; display: flex; flex-direction: column; min-width: 0; border: 1px solid transparent; }
        .col[data-col="todo"]  { background: linear-gradient(180deg, #fee2e2 0%, #fef2f2 35%, #f5f6f9 100%); border-color: #fecaca; }
        .col[data-col="doing"] { background: linear-gradient(180deg, #fef3c7 0%, #fffbeb 35%, #f5f6f9 100%); border-color: #fde68a; }
        .col[data-col="done"]  { background: linear-gradient(180deg, #d1fae5 0%, #f0fdf4 35%, #f5f6f9 100%); border-color: #a7f3d0; }
        .col-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
        .col-header .count { background: rgba(255,255,255,0.85); border-radius: 10px; padding: 1px 8px; font-size: 11px; color: #555; }
        .col-header .col-actions { display: flex; gap: 6px; align-items: center; }
        .col-header .archive-all { background: rgba(255,255,255,0.85); border: 1px solid #a7f3d0; color: #065f46; font-size: 10px; padding: 2px 8px; border-radius: 10px; cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 500; }
        .col-header .archive-all:hover { background: #fff; }
        .col-header .archive-all:disabled { opacity: 0.4; cursor: not-allowed; }
        .col[data-col="todo"]  .col-header { color: #b91c1c; }
        .col[data-col="doing"] .col-header { color: #a16207; }
        .col[data-col="done"]  .col-header { color: #15803d; }
        .cards { display: flex; flex-direction: column; gap: 6px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; box-shadow: 0 1px 1px rgba(0,0,0,0.03); cursor: pointer; transition: box-shadow 0.15s, transform 0.05s; }
        .card:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        .card:active { transform: translateY(1px); }
        .card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; font-size: 10.5px; color: #6b7280; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .badge-acceso { background: #fee2e2; color: #b91c1c; }
        .badge-reembolso { background: #ffedd5; color: #c2410c; }
        .badge-otro { background: #e0e7ff; color: #4338ca; }
        .channel-tag { color: #4f46e5; font-weight: 500; }
        .card-title { font-weight: 600; font-size: 13px; margin: 2px 0 6px; line-height: 1.3; word-break: break-word; }
        .card-summary { font-size: 12px; color: #4b5563; margin-bottom: 8px; line-height: 1.4; word-break: break-word; }
        .card-waiting { font-size: 11.5px; color: #374151; margin-bottom: 8px; }
        .card-waiting b { color: #111; }
        .card-actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
        .btn { border: 1px solid #d1d5db; background: #fff; color: #374151; padding: 4px 9px; border-radius: 5px; font-size: 11px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 3px; }
        .btn:hover { background: #f3f4f6; }
        .btn-primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
        .btn-done { background: #d1fae5; color: #065f46; border-color: #6ee7b7; }
        .btn-back { color: #6b7280; }
        .empty { text-align: center; color: #9ca3af; font-size: 12px; padding: 20px 8px; font-style: italic; }
        .loading { text-align: center; padding: 40px 20px; color: #6b7280; grid-column: 1 / -1; }
        .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 6px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { background: #fef2f2; color: #991b1b; padding: 10px; border-radius: 8px; margin: 12px; font-size: 12px; }
        details.archive { margin-top: 8px; padding: 6px 8px; background: #fff; border-radius: 6px; border: 1px solid #e5e7eb; }
        details.archive summary { cursor: pointer; font-size: 11px; color: #6b7280; }
        details.archive .archived-item { font-size: 11px; padding: 4px 0; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; gap: 6px; }
        details.archive .archived-item a { color: #4f46e5; text-decoration: none; }
        .restore-btn { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 11px; padding: 0; }
        .age-fresh { color: #15803d; }
        .age-medium { color: #c2410c; }
        .age-old { color: #b91c1c; font-weight: 500; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #fff; border-radius: 12px; max-width: 720px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #e5e7eb; }
        .modal-header h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; }
        .modal-header .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
        .modal-close { background: none; border: none; font-size: 22px; line-height: 1; cursor: pointer; color: #6b7280; padding: 0 4px; }
        .modal-close:hover { color: #111; }
        .modal-body { overflow-y: auto; padding: 14px 18px; flex: 1; }
        .modal-msg { padding: 10px 12px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #ddd; background: #fafbfc; }
        .modal-msg:last-child { margin-bottom: 0; }
        .modal-msg .author { font-weight: 700; font-size: 13px; }
        .modal-msg .time { font-size: 11px; color: #9ca3af; margin-left: 8px; font-weight: 400; }
        .modal-msg .text { font-size: 13.5px; color: #1f2937; margin-top: 4px; white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
        .modal-msg .text .mention { background: #e0e7ff; color: #4338ca; padding: 1px 5px; border-radius: 4px; font-weight: 500; }
        .modal-msg .text .link { color: #2563eb; text-decoration: underline; }
        .modal-msg .text .link:hover { color: #1d4ed8; }
        .modal-footer { padding: 10px 18px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 8px; background: #f8f9fb; }
        .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 10px 16px; border-radius: 8px; font-size: 12.5px; box-shadow: 0 6px 20px rgba(0,0,0,0.18); z-index: 200; max-width: 90vw; }
        .toast.ok   { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .toast.warn { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
        .toast.err  { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .toast.info { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
      `}</style>

      <div className="header">
        <div>
          <h1>📋 Pipeline Incidencias Ventas</h1>
          <div className="stats">
            <span><b>{filtered.length}</b> hilos</span>
            <span>⏳ <b>{waitingCount}</b> esperan respuesta</span>
            <span>🔄 <b>{buckets.doing.length}</b> en progreso</span>
            <span>✅ <b>{buckets.done.length}</b> hechos</span>
          </div>
        </div>
        <div className="channel-filter">
          <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Todos</button>
          {config.channels.map(c => (
            <button key={c.id} className={activeFilter === c.id ? 'active' : ''} onClick={() => setActiveFilter(c.id)}>
              {channelLabel(c.id)}
            </button>
          ))}
          <button className="refresh-btn" onClick={loadAll} disabled={loading}>↻ {loading ? 'Cargando…' : 'Refrescar'}</button>
        </div>
      </div>

      <div className="filter-row">
        <span className="label">Categoría:</span>
        {[
          { key: 'all', label: 'Todas', cls: '' },
          { key: 'acceso', label: '🔴 Acceso', cls: 'badge-acceso' },
          { key: 'reembolso', label: '💰 Reembolso', cls: 'badge-reembolso' },
          { key: 'otro', label: '📌 Otro', cls: 'badge-otro' },
        ].map(cat => {
          const count = cat.key === 'all'
            ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
            : (categoryCounts[cat.key] || 0);
          return (
            <button key={cat.key} className={activeCategory === cat.key ? 'active' : ''} onClick={() => setActiveCategory(cat.key)}>
              {cat.label}<span className="count">({count})</span>
            </button>
          );
        })}
      </div>

      {error && <div className="error">Error: {error}</div>}

      <div className="board">
        {loading ? (
          <div className="loading"><span className="spinner"></span> {progress || 'Cargando…'}</div>
        ) : (
          ['todo', 'doing', 'done'].map(colKey => {
            const labels = { todo: '📥 Por revisar', doing: '🔄 En progreso', done: '✅ Hecho' };
            const empties = { todo: '✨ Sin pendientes', doing: 'Nada en progreso', done: 'Aún nada cerrado' };
            const items = buckets[colKey];
            return (
              <div key={colKey} className="col" data-col={colKey}>
                <div className="col-header">
                  <span>{labels[colKey]}</span>
                  <span className="col-actions">
                    {colKey === 'done' && (
                      <button className="archive-all" onClick={archiveAllDone} disabled={items.length === 0} title="Archivar todas las tarjetas de Hecho">
                        🗑 Archivar todos
                      </button>
                    )}
                    <span className="count">{items.length}</span>
                  </span>
                </div>
                <div className="cards">
                  {items.length === 0 ? (
                    <div className="empty">{empties[colKey]}</div>
                  ) : items.map(c => {
                    const age = ageFromTs(c.ts);
                    return (
                      <div key={c.id} className="card" onClick={() => openModal(c)}>
                        <div className="card-meta">
                          <span>
                            <span className={`badge ${c.category.cls}`}>{c.category.label}</span>{' '}
                            <span className="channel-tag">#{channelLabel(c.channelId)}</span>
                          </span>
                          <span className={age.cls}>{age.text}</span>
                        </div>
                        <div className="card-title">{c.title}</div>
                        <div className="card-summary">{c.lastText}</div>
                        <div className="card-waiting">
                          {c.waitingForMe ? <b>⏳ Espera respuesta tuya</b> : <span style={{ color: '#6b7280' }}>Última: {c.lastUser}</span>}
                        </div>
                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                          <a className="btn btn-primary" href={c.deepLink || c.link} target="slack-thread" rel="noopener noreferrer">💬 Ver hilo</a>
                          {colKey === 'todo' && (
                            <>
                              <button className="btn" onClick={() => setCaseStatus(c.id, 'doing')}>▶ En progreso</button>
                              <button className="btn btn-done" onClick={() => setCaseStatus(c.id, 'done')}>✓ Hecho</button>
                            </>
                          )}
                          {colKey === 'doing' && (
                            <>
                              <button className="btn btn-back" onClick={() => setCaseStatus(c.id, 'todo')}>← Por revisar</button>
                              <button className="btn btn-done" onClick={() => setCaseStatus(c.id, 'done')}>✓ Hecho</button>
                            </>
                          )}
                          {colKey === 'done' && (
                            <>
                              <button className="btn btn-back" onClick={() => setCaseStatus(c.id, 'doing')}>↩ Reabrir</button>
                              <button className="btn btn-back" onClick={() => archiveCase(c.id)}>🗑 Archivar</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* archived section */}
                {colKey === 'done' && archived.length > 0 && (
                  <details className="archive">
                    <summary>Archivados ({archived.length})</summary>
                    {archived.map(c => (
                      <div key={c.id} className="archived-item">
                        <a href={c.link} target="_blank" rel="noopener noreferrer">{c.title}</a>
                        <button className="restore-btn" onClick={() => restoreCase(c.id)}>↩ restaurar</button>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>

      {toast && (
        <div className={`toast ${toast.kind}`} onClick={() => setToast(null)}>{toast.msg}</div>
      )}

      {modalCase && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ minWidth: 0 }}>
                <h2>{modalCase.title}</h2>
                <div className="meta">
                  <span className={`badge ${modalCase.category.cls}`}>{modalCase.category.label}</span>{' '}
                  <span className="channel-tag">#{channelLabel(modalCase.channelId)}</span>
                  {' · '}{modalMessages.length || modalCase.replyCount + 1} mensajes
                </div>
              </div>
              <button className="modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
            </div>
            <div className="modal-body">
              {modalLoading ? (
                <div className="loading"><span className="spinner"></span> Cargando hilo…</div>
              ) : modalMessages.length === 0 ? (
                <div className="empty">No se pudo cargar el hilo.</div>
              ) : modalMessages.map((m, i) => {
                const uid = (m && m.user) || '';
                const color = colorForUser(uid);
                const author = (m && modalUsers[uid]) || uid || 'desconocido';
                return (
                  <div key={(m && m.ts) || i} className="modal-msg" style={{ borderLeftColor: color, background: color + '0d' }}>
                    <div>
                      <span className="author" style={{ color }}>{author}</span>
                      <span className="time">{m && m.ts ? formatTs(m.ts) : ''}</span>
                    </div>
                    <div className="text">{formatSlackText(m && m.text, modalUsers)}</div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <a className="btn btn-primary" href={modalCase.deepLink || modalCase.link} target="slack-thread" rel="noopener noreferrer">💬 Abrir en Slack</a>
              <button className="btn" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
