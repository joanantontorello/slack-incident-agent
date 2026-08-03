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
  recycle: '♻️', repeat: '🔁', repeat_one: '🔂', refresh: '🔄',
  new: '🆕', ok: '🆗', top: '🔝', up: '🆙', cool: '🆒', free: '🆓',
  bangbang: '‼️', interrobang: '⁉️', v: '✌️', crossed_fingers: '🤞',
  writing_hand_tone: '✍️', memo_pad: '📝', ledger: '📒', notebook_with_decorative_cover: '📔',
  card_index: '📇', card_file_box: '🗃️', file_folder: '📁', open_file_folder: '📂',
  bookmark_tabs: '📑', spiral_notepad: '🗒️', dart: '🎯', chart: '💹', money_mouth_face: '🤑',
  green_apple: '🍏', apple: '🍎', hearts: '♥️', spades: '♠️', diamonds: '♦️', clubs: '♣️',
};

// ============ HELPERS ============
// ============ STATE PERSISTENCE ============
// Si KV está habilitado en el servidor → state compartido vía /api/state
// (polling cada 15s). Si no → fallback a localStorage local.
async function fetchServerState() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    const data = await r.json();
    return data; // { enabled, cases }
  } catch (e) {
    return { enabled: false, cases: {}, error: String(e.message || e) };
  }
}

async function postPatches(patches) {
  try {
    const r = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patches }),
      cache: 'no-store',
    });
    return r.json(); // { enabled, cases }
  } catch (e) {
    return { enabled: false, cases: null, error: String(e.message || e) };
  }
}

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
  const cleaned = shortenText(text, 400, users);
  // Prefer email si aparece — es lo que Joan usa para identificar el caso.
  const emailMatch = cleaned.match(/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return emailMatch[0];
  // Si no, frase corta de la primera línea significativa.
  const lines = cleaned.split(/\n|—|\*|\.\s|:/).map(l => l.trim()).filter(l => l.length > 3);
  const first = lines[0] || cleaned;
  return shortenText(first, 60, users);
}

// Detecta si el input es un link de Slack (https://… o slack://) y
// devuelve {channelId, ts} si lo es, o null si no.
function parseSlackUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  // HTTPS form: …/archives/CHANNEL/pTS o con ?thread_ts=… (gana thread_ts)
  const httpsMatch = s.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (httpsMatch) {
    const channelId = httpsMatch[1];
    const tsNoDot = httpsMatch[2];
    const tt = s.match(/thread_ts=([0-9.]+)/);
    if (tt) return { channelId, ts: tt[1] };
    const ts = tsNoDot.length > 6 ? `${tsNoDot.slice(0, -6)}.${tsNoDot.slice(-6)}` : tsNoDot;
    return { channelId, ts };
  }
  // slack:// form
  const deep = s.match(/slack:\/\/[^?]*\?[^#]*id=([A-Z0-9]+)[^#]*message=([\d.]+)/);
  if (deep) return { channelId: deep[1], ts: deep[2] };
  return null;
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
  const [sharedMode, setSharedMode] = useState(false); // true si KV está habilitado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [config, setConfig] = useState({ myUserId: '', channels: [], team: null });
  const [progress, setProgress] = useState('');
  const [modalCase, setModalCase] = useState(null);
  const [modalMessages, setModalMessages] = useState([]);
  const [modalUsers, setModalUsers] = useState({});
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [undoAction, setUndoAction] = useState(null);
  const [lastSeenTs, setLastSeenTs] = useState(0);

  // Inicialización del estado: intenta KV; si no, localStorage.
  // Migración: si KV está vacío y localStorage tiene datos, los sube
  // (one-shot — solo la primera vez que el KV esté vacío).
  useEffect(() => {
    (async () => {
      const s = await fetchServerState();
      if (s.enabled) {
        setSharedMode(true);
        const serverCases = s.cases || {};
        const localCases = (loadState().cases) || {};
        const serverEmpty = Object.keys(serverCases).length === 0;
        const localHasData = Object.keys(localCases).length > 0;
        if (serverEmpty && localHasData) {
          const patches = Object.entries(localCases).map(([caseId, patch]) => ({ caseId, patch }));
          const res = await postPatches(patches);
          if (res.enabled && res.cases) {
            setState({ cases: res.cases });
          } else {
            setState({ cases: serverCases });
          }
        } else {
          setState({ cases: serverCases });
        }
      } else {
        setSharedMode(false);
        setState(loadState());
      }
    })();
  }, []);

  // Polling de state compartido cada 15s (solo si KV activo y pestaña visible).
  useEffect(() => {
    if (!sharedMode) return;
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      const s = await fetchServerState();
      if (cancelled) return;
      if (s.enabled) setState({ cases: s.cases || {} });
    };
    const id = setInterval(tick, 15000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [sharedMode]);

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

  // Persiste un lote de patches. Actualiza state local (optimista) y
  // envía a KV; si KV no está, guarda en localStorage.
  const persistPatches = useCallback(async (patches) => {
    setState(prev => {
      const cases = { ...prev.cases };
      for (const { caseId, patch } of patches) {
        if (!caseId || !patch) continue;
        cases[caseId] = { ...(cases[caseId] || {}), ...patch };
      }
      const next = { ...prev, cases };
      if (!sharedMode) saveState(next);
      return next;
    });
    if (sharedMode) {
      const res = await postPatches(patches);
      if (res.enabled && res.cases) setState({ cases: res.cases });
      else if (res.error) console.warn('sync state:', res.error);
    }
  }, [sharedMode]);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setProgress('Leyendo canales…');
    }
    setError(null);
    try {
      const cfgRes = await fetch('/api/config').then(r => r.json());
      setConfig(cfgRes);
      const myId = cfgRes.myUserId;

      const msgsRes = await fetch('/api/messages?days=14').then(r => r.json());
      if (msgsRes.error) throw new Error(msgsRes.error);

      // Gather all user IDs to resolve names (autores + menciones <@U…>)
      const userIdsToResolve = new Set();
      const collectFromText = (text) => {
        if (!text) return;
        const re = /<@([A-Z0-9]+)(?:\|[^>]+)?>/g;
        let m; while ((m = re.exec(text)) !== null) userIdsToResolve.add(m[1]);
      };
      (msgsRes.channels || []).forEach(c => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        msgs.forEach(m => {
          if (!m) return;
          if (m.user) userIdsToResolve.add(m.user);
          collectFromText(m.text);
        });
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
            (r.messages || []).forEach(m => {
              if (m.user) userIdsToResolve.add(m.user);
              collectFromText(m.text);
            });
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

          // ¿Alguno de los usuarios "responsables" (Joan, Lautaro, …)
          // reaccionó con ✅ al mensaje raíz? → considerar Hecho.
          const autoDoneIds = Array.isArray(cfgRes.autoDoneUserIds) && cfgRes.autoDoneUserIds.length > 0
            ? cfgRes.autoDoneUserIds
            : (myId ? [myId] : []);
          const rootReactions = Array.isArray(root.reactions) ? root.reactions : [];
          const checkedByMe = autoDoneIds.length > 0 && rootReactions.some(r =>
            r && r.name === 'white_check_mark' && Array.isArray(r.users) &&
            r.users.some(u => autoDoneIds.includes(u))
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

      // Auto-promoción a "done" para hilos donde Joan ya reaccionó con ✅
      // en Slack (única fuente de verdad). Se aplica sobre el state actual
      // (KV si está, localStorage si no).
      const baseCases = (sharedMode ? state.cases : (loadState().cases || {}));
      const patches = [];
      for (const c of allCases) {
        if (!c.checkedByMe) continue;
        const prev = baseCases[c.id] || {};
        if (prev.status !== 'done') {
          patches.push({ caseId: c.id, patch: { status: 'done', doneAt: prev.doneAt || Date.now(), autoFromSlack: true } });
        }
      }
      if (patches.length > 0) {
        persistPatches(patches);
      }

      if (!silent) {
        // Solo actualizamos "última visita" en refresh manual — así el
        // auto-refresh puede traer nuevos y mantener el puntito azul.
        const now = Date.now() / 1000;
        try { localStorage.setItem('pipeline_lastSeen', String(now)); } catch (e) {}
        setLastSeenTs(now);
      }
      setLoading(false);
      setProgress('');
    } catch (e) {
      setError(e.message || String(e));
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Inicializar lastSeenTs (nada marcado como nuevo en el primer arranque)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pipeline_lastSeen');
      if (stored) setLastSeenTs(parseFloat(stored));
      else {
        const now = Date.now() / 1000;
        localStorage.setItem('pipeline_lastSeen', String(now));
        setLastSeenTs(now);
      }
    } catch (e) {}
  }, []);

  // Auto-refresh silencioso cada 5 min mientras la pestaña esté visible
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && !loading) loadAll({ silent: true });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadAll, loading]);

  const openModal = useCallback(async (c) => {
    setModalCase(c);
    setModalLoading(true);
    setModalMessages([]);
    setModalUsers({});
    try {
      const r = await fetch(`/api/thread?channel=${c.channelId}&ts=${c.ts}`).then(r => r.json());
      const msgs = Array.isArray(r.messages) ? r.messages : [];
      setModalMessages(msgs);
      // Recolectar autores + menciones <@U…> dentro del texto
      const idSet = new Set();
      const re = /<@([A-Z0-9]+)(?:\|[^>]+)?>/g;
      msgs.forEach(m => {
        if (m && m.user) idSet.add(m.user);
        if (m && m.text) {
          let mm; while ((mm = re.exec(m.text)) !== null) idSet.add(mm[1]);
          re.lastIndex = 0;
        }
      });
      const ids = Array.from(idSet).join(',');
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

  const syncReaction = useCallback(async (c, { emoji, undo = false, markRead = false }) => {
    if (!c || !c.channelId || !c.ts) return;
    try {
      const res = await fetch('/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: c.channelId, ts: c.ts, emoji, undo, markRead }),
      });
      const data = await res.json().catch(() => ({}));
      // Silent — log solo en consola para debug, no molestar al usuario
      // con warnings de missing_scope u otros detalles del backend.
      if (data.reaction && data.reaction !== 'ok' && data.reaction !== 'noop') {
        console.warn('slack reaction:', data.reaction, 'emoji=', emoji);
      }
      if (data.mark && data.mark !== 'ok' && !String(data.mark).startsWith('skipped')) {
        console.warn('slack mark:', data.mark);
      }
    } catch (e) {
      console.warn('sync failed:', e);
    }
  }, []);

  const applyReactionsForTransition = useCallback((c, from, to) => {
    if (from === to) return;
    if (to === 'doing' && from !== 'doing') syncReaction(c, { emoji: 'eyes' });
    else if (from === 'doing' && to !== 'doing') syncReaction(c, { emoji: 'eyes', undo: true });
    if (to === 'done' && from !== 'done') syncReaction(c, { emoji: 'white_check_mark', markRead: true });
    else if (from === 'done' && to !== 'done') syncReaction(c, { emoji: 'white_check_mark', undo: true });
  }, [syncReaction]);

  const setCaseStatus = (caseId, status) => {
    const prev = state.cases[caseId] || {};
    const prevStatus = prev.status || 'todo';
    if (prevStatus === status) return;
    const patch = { status, ...(status === 'done' ? { doneAt: Date.now() } : {}) };
    persistPatches([{ caseId, patch }]);
    const c = cases.find(x => x.id === caseId);
    if (!c) return;
    applyReactionsForTransition(c, prevStatus, status);
    const label = status === 'done' ? 'Movida a Hecho' : status === 'doing' ? 'Movida a En progreso' : 'Movida a Por revisar';
    setUndoAction({
      id: Date.now(),
      label,
      run: () => {
        persistPatches([{ caseId, patch: { status: prevStatus, ...(prevStatus !== 'done' && prev.doneAt ? {} : {}) } }]);
        applyReactionsForTransition(c, status, prevStatus);
        setUndoAction(null);
      },
    });
  };

  const archiveAllDone = () => {
    const doneIds = cases
      .filter(c => (state.cases[c.id]?.status || 'todo') === 'done' && !state.cases[c.id]?.archived)
      .map(c => c.id);
    if (doneIds.length === 0) return;
    persistPatches(doneIds.map(caseId => ({ caseId, patch: { archived: true } })));
    setUndoAction({
      id: Date.now(),
      label: `Archivadas ${doneIds.length} ${doneIds.length === 1 ? 'tarjeta' : 'tarjetas'}`,
      run: () => {
        persistPatches(doneIds.map(caseId => ({ caseId, patch: { archived: false } })));
        setUndoAction(null);
      },
    });
  };
  const archiveCase = (caseId) => {
    persistPatches([{ caseId, patch: { archived: true } }]);
    setUndoAction({
      id: Date.now(),
      label: 'Archivada',
      run: () => {
        persistPatches([{ caseId, patch: { archived: false } }]);
        setUndoAction(null);
      },
    });
  };
  const restoreCase = (caseId) => {
    persistPatches([{ caseId, patch: { archived: false, status: 'todo' } }]);
  };

  // Auto-dismiss undo tras 6s
  useEffect(() => {
    if (!undoAction) return;
    const id = setTimeout(() => setUndoAction(u => (u && u.id === undoAction.id ? null : u)), 6000);
    return () => clearTimeout(id);
  }, [undoAction]);

  // Filter and bucket
  const trimmedQuery = searchQuery.trim();
  const parsedUrl = trimmedQuery ? parseSlackUrl(trimmedQuery) : null;
  const textQuery = !parsedUrl && trimmedQuery ? trimmedQuery.toLowerCase() : '';
  const matchesSearch = (c) => {
    if (!trimmedQuery) return true;
    if (parsedUrl) return c.channelId === parsedUrl.channelId && String(c.ts) === String(parsedUrl.ts);
    return (
      (c.title && c.title.toLowerCase().includes(textQuery)) ||
      (c.summary && c.summary.toLowerCase().includes(textQuery)) ||
      (c.lastText && c.lastText.toLowerCase().includes(textQuery)) ||
      (c.lastUser && c.lastUser.toLowerCase().includes(textQuery))
    );
  };
  const filtered = cases.filter(c =>
    (activeFilter === 'all' || c.channelId === activeFilter) &&
    (activeCategory === 'all' || c.category.key === activeCategory) &&
    (!onlyWaiting || c.waitingForMe) &&
    matchesSearch(c)
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
      <style dangerouslySetInnerHTML={{ __html: `
        :root { color-scheme: light; --brand: #0068FF; --brand-dark: #0052cc; --bg: #f5f7fb; --ink: #0f172a; --muted: #64748b; --border: #e2e8f0; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif; margin: 0; background: var(--bg); color: var(--ink); font-size: 13px; line-height: 1.45; -webkit-font-smoothing: antialiased; }

        /* HEADER */
        .header { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; background: #fff; position: sticky; top: 0; z-index: 10; gap: 14px; flex-wrap: wrap; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-logo { width: 40px; height: 40px; border-radius: 10px; object-fit: contain; background: #fff; }
        .brand h1 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); letter-spacing: -0.2px; }
        .brand .subtitle { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* PILL TOGGLE GROUP — estilo recobros: contenedor blanco, activo azul */
        .pill-group { display: inline-flex; background: #fff; border-radius: 12px; padding: 4px; gap: 2px; box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04); }
        .pill-group button { background: transparent; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; color: var(--muted); cursor: pointer; font-weight: 500; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
        .pill-group button:hover { color: var(--ink); }
        .pill-group button.active { background: var(--brand); color: #fff; font-weight: 600; box-shadow: 0 1px 3px rgba(0,104,255,0.35); }

        /* HEADER BUTTONS */
        .icon-btn { background: #fff; color: var(--ink); padding: 7px 14px; border-radius: 8px; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500; transition: all 0.15s; border: none; box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04); }
        .icon-btn:hover { background: #f8fafc; box-shadow: 0 1px 3px rgba(15,23,42,0.1), 0 0 0 1px rgba(15,23,42,0.08); }
        .refresh-btn { background: var(--brand); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,104,255,0.25); }
        .refresh-btn:hover { background: var(--brand-dark); }
        .refresh-btn:disabled { opacity: 0.5; cursor: wait; }
        .logout-btn { background: transparent; border: none; color: var(--muted); padding: 6px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
        .logout-btn:hover { color: var(--ink); background: #f1f5f9; }

        /* SEARCH */
        .search-box { display: flex; align-items: center; gap: 8px; background: #f1f5f9; border-radius: 10px; padding: 8px 14px; flex: 1; max-width: 460px; transition: background 0.15s, box-shadow 0.15s; }
        .search-box:focus-within { background: #fff; box-shadow: 0 0 0 2px var(--brand); }
        .search-box input { border: none; outline: none; background: transparent; flex: 1; font-size: 13px; color: var(--ink); padding: 2px 0; }
        .search-box input::placeholder { color: #94a3b8; }
        .search-box .clear { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 16px; padding: 0; }
        .search-box .clear:hover { color: var(--ink); }
        .search-status { font-size: 12px; color: var(--muted); padding: 6px 22px; background: rgba(255,255,255,0.7); }
        .search-status .miss { color: #b91c1c; font-weight: 500; }

        /* FILTER ROW */
        .filter-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 22px; background: #fff; }
        .filter-row .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .filter-row .cat-btn { background: #f1f5f9; border: none; border-radius: 999px; padding: 6px 14px; font-size: 12px; cursor: pointer; color: var(--muted); font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .filter-row .cat-btn:hover { background: #e2e8f0; color: var(--ink); }
        .filter-row .cat-btn.active { background: var(--ink); color: #fff; }
        .filter-row .cat-btn .count { opacity: 0.6; font-size: 11px; }
        .waiting-toggle { background: #fff7ed; border: none; color: #b45309; padding: 6px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.15s; }
        .waiting-toggle:hover { background: #ffedd5; }
        .waiting-toggle.active { background: #f59e0b; color: #fff; }
        .cat-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }

        /* BOARD */
        .board { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; padding: 18px 22px; min-height: calc(100vh - 130px); }
        @media (max-width: 900px) { .board { grid-template-columns: 1fr; } }
        .col { border-radius: 14px; padding: 14px; display: flex; flex-direction: column; min-width: 0; }
        .col[data-col="todo"]  { background: linear-gradient(180deg, #fee2e2 0%, #fef7f7 45%, #ffffff 100%); }
        .col[data-col="doing"] { background: linear-gradient(180deg, #fef3c7 0%, #fffdf3 45%, #ffffff 100%); }
        .col[data-col="done"]  { background: linear-gradient(180deg, #d1fae5 0%, #f5fdf7 45%, #ffffff 100%); }
        .col-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 12px; font-weight: 600; font-size: 12px; letter-spacing: 0.3px; text-transform: uppercase; }
        .col-header .col-title { display: inline-flex; align-items: center; gap: 8px; }
        .col-header .col-dot { width: 8px; height: 8px; border-radius: 50%; }
        .col[data-col="todo"]  .col-dot { background: #ef4444; }
        .col[data-col="doing"] .col-dot { background: #f59e0b; }
        .col[data-col="done"]  .col-dot { background: #10b981; }
        .col[data-col="todo"]  .col-header { color: #b91c1c; }
        .col[data-col="doing"] .col-header { color: #b45309; }
        .col[data-col="done"]  .col-header { color: #047857; }
        .col-header .count { background: #f1f5f9; color: var(--muted); border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; text-transform: none; letter-spacing: 0; }
        .col-header .col-actions { display: flex; gap: 6px; align-items: center; }
        .archive-all { background: #f1f5f9; border: 1px solid transparent; color: var(--muted); font-size: 11px; padding: 3px 10px; border-radius: 999px; cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 500; transition: all 0.15s; }
        .archive-all:hover { background: #e2e8f0; color: var(--ink); }
        .archive-all:disabled { opacity: 0.4; cursor: not-allowed; }

        /* CARDS */
        .cards { display: flex; flex-direction: column; gap: 8px; }
        .card { background: #fff; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s; position: relative; box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.03); }
        .card:hover { box-shadow: 0 4px 14px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06); transform: translateY(-1px); }
        .card.waiting { box-shadow: 0 1px 2px rgba(15,23,42,0.05), inset 3px 0 0 #f59e0b, 0 0 0 1px rgba(15,23,42,0.03); }
        .card.waiting:hover { box-shadow: 0 4px 14px rgba(15,23,42,0.08), inset 3px 0 0 #f59e0b, 0 0 0 1px rgba(15,23,42,0.06); }
        .card.is-new::before { content: ''; position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 3px #fff; }
        .card.is-new .card-meta { padding-right: 16px; }
        .card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; font-size: 11px; color: var(--muted); }
        .card-meta .left { display: inline-flex; align-items: center; gap: 6px; }
        .cat-tag { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; }
        .cat-tag.acceso    { color: #b91c1c; }
        .cat-tag.reembolso { color: #c2410c; }
        .cat-tag.otro      { color: #4338ca; }
        .cat-tag .dot { width: 6px; height: 6px; border-radius: 50%; }
        .cat-tag.acceso    .dot { background: #dc2626; }
        .cat-tag.reembolso .dot { background: #ea580c; }
        .cat-tag.otro      .dot { background: #6366f1; }
        .channel-tag { color: var(--muted); font-weight: 500; }
        .card-title { font-weight: 600; font-size: 13.5px; margin: 2px 0 0; line-height: 1.35; word-break: break-word; color: var(--ink); }
        .card-summary { font-size: 12px; color: #64748b; margin-bottom: 10px; line-height: 1.45; word-break: break-word; }
        .card-actions { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; opacity: 0; max-height: 0; overflow: hidden; margin-top: 0; transition: opacity 0.15s ease, max-height 0.2s ease, margin-top 0.2s ease; pointer-events: none; }
        .card:hover .card-actions, .card:focus-within .card-actions { opacity: 1; max-height: 60px; margin-top: 10px; pointer-events: auto; }
        .btn { background: #f1f5f9; color: var(--ink); padding: 5px 11px; border-radius: 7px; font-size: 11.5px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500; transition: all 0.15s; border: none; }
        .btn:hover { background: #e2e8f0; }
        .btn-primary { background: var(--brand); color: #fff; }
        .btn-primary:hover { background: var(--brand-dark); }
        .btn-done { background: #dcfce7; color: #047857; }
        .btn-done:hover { background: #bbf7d0; }
        .btn-back { color: var(--muted); background: transparent; }
        .btn-back:hover { background: #f1f5f9; color: var(--ink); }
        .empty { text-align: center; color: #94a3b8; font-size: 12px; padding: 24px 8px; }
        .loading { text-align: center; padding: 48px 20px; color: var(--muted); grid-column: 1 / -1; }
        .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: var(--brand); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { background: #fef2f2; color: #991b1b; padding: 12px 16px; border-radius: 8px; margin: 12px 22px; font-size: 12.5px; }

        /* ARCHIVED */
        details.archive { margin-top: 10px; padding: 8px 12px; background: rgba(255,255,255,0.6); border-radius: 10px; }
        details.archive summary { cursor: pointer; font-size: 11.5px; color: var(--muted); font-weight: 500; }
        details.archive .archived-item { font-size: 11.5px; padding: 6px 0; border-top: 1px solid rgba(15,23,42,0.06); display: flex; justify-content: space-between; gap: 6px; }
        details.archive .archived-item a { color: var(--brand); text-decoration: none; }
        details.archive .archived-item a:hover { text-decoration: underline; }
        .restore-btn { background: none; border: none; color: var(--brand); cursor: pointer; font-size: 11px; padding: 0; font-weight: 500; }
        .age-fresh { color: #047857; }
        .age-medium { color: #c2410c; }
        .age-old { color: #b91c1c; font-weight: 600; }
        .header-stats { display: inline-flex; gap: 6px; align-items: center; font-size: 11.5px; color: var(--muted); }
        .header-stats b { color: var(--ink); font-weight: 600; }
        .header-stats .sep { color: #cbd5e1; }
        .shared-tag { font-size: 10.5px; color: var(--muted); padding: 3px 8px; border-radius: 999px; background: #eef2f7; font-weight: 500; }
        .shared-tag.local { background: #fef3c7; color: #92400e; }

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
        /* Undo bar — minimalista, oscuro, centrado abajo */
        .undo-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #f8fafc; padding: 10px 16px; border-radius: 999px; font-size: 13px; display: flex; align-items: center; gap: 14px; box-shadow: 0 10px 30px rgba(15,23,42,0.25); z-index: 200; animation: undoIn 0.18s ease-out; }
        .undo-bar .undo-label { font-weight: 500; }
        .undo-bar button { background: none; border: none; color: #93c5fd; cursor: pointer; font-size: 13px; font-weight: 600; padding: 0; }
        .undo-bar button:hover { color: #dbeafe; }
        .undo-bar .close { color: #64748b; font-size: 16px; margin-left: 2px; line-height: 1; }
        .undo-bar .close:hover { color: #cbd5e1; }
        @keyframes undoIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      ` }} />

      <div className="header">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="https://comisiones-app-inky.vercel.app/static/logo-ico.png" alt="ICO" />
          <div>
            <h1>Pipeline de Incidencias</h1>
            <div className="header-stats">
              <span><b>{filtered.length}</b> hilos</span>
              <span className="sep">·</span>
              <span><b>{waitingCount}</b> esperan respuesta</span>
              <span className="sep">·</span>
              <span><b>{buckets.doing.length}</b> en progreso</span>
              <span className="sep">·</span>
              <span><b>{buckets.done.length}</b> hechos</span>
              <span className={`shared-tag${sharedMode ? '' : ' local'}`} title={sharedMode ? 'Estado compartido entre todos los usuarios' : 'Estado solo en este navegador'}>
                {sharedMode ? 'Compartido' : 'Local'}
              </span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="pill-group">
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Todos</button>
            {config.channels.map(c => (
              <button key={c.id} className={activeFilter === c.id ? 'active' : ''} onClick={() => setActiveFilter(c.id)}>
                {channelLabel(c.id)}
              </button>
            ))}
          </div>
          <a className="icon-btn" href="/manual" target="_blank" rel="noopener noreferrer" title="Manual de uso">Manual</a>
          <button className="refresh-btn" onClick={loadAll} disabled={loading}>
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
          <button
            className="logout-btn"
            onClick={async () => {
              try { await fetch('/api/login', { method: 'DELETE' }); } catch (e) {}
              window.location.href = '/login';
            }}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input
            type="text"
            placeholder="Pega un link de Slack o busca por texto…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear" onClick={() => setSearchQuery('')} aria-label="Limpiar">×</button>
          )}
        </div>
        <button
          className={`waiting-toggle${onlyWaiting ? ' active' : ''}`}
          onClick={() => setOnlyWaiting(v => !v)}
          title="Mostrar solo hilos donde se espera respuesta tuya"
        >
          Espera mi respuesta ({cases.filter(c => c.waitingForMe).length})
        </button>
        <span style={{ width: 4 }} />
        <span className="label">Categoría</span>
        {[
          { key: 'all', label: 'Todas', dot: null },
          { key: 'acceso', label: 'Acceso', dot: '#dc2626' },
          { key: 'reembolso', label: 'Reembolso', dot: '#ea580c' },
          { key: 'otro', label: 'Otro', dot: '#6366f1' },
        ].map(cat => {
          const count = cat.key === 'all'
            ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
            : (categoryCounts[cat.key] || 0);
          return (
            <button key={cat.key} className={`cat-btn${activeCategory === cat.key ? ' active' : ''}`} onClick={() => setActiveCategory(cat.key)}>
              {cat.dot && <span className="cat-dot" style={{ background: cat.dot }} />}
              {cat.label} <span className="count">{count}</span>
            </button>
          );
        })}
      </div>
      {trimmedQuery && (
        <div className="search-status">
          {parsedUrl ? (
            filtered.length > 0
              ? <>Link Slack → encontrado en <b>{channelLabel(parsedUrl.channelId)}</b></>
              : <span className="miss">Link Slack → <b>no encontrado</b> en el pipeline (puede estar fuera de los últimos 14 días o en un canal no monitorizado)</span>
          ) : (
            <>Filtrando por <b>"{trimmedQuery}"</b> → {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</>
          )}
        </div>
      )}

      {error && <div className="error">Error: {error}</div>}

      <div className="board">
        {loading ? (
          <div className="loading"><span className="spinner"></span> {progress || 'Cargando…'}</div>
        ) : (
          ['todo', 'doing', 'done'].map(colKey => {
            const labels = { todo: 'Por revisar', doing: 'En progreso', done: 'Hecho' };
            const empties = { todo: 'Sin pendientes', doing: 'Nada en progreso', done: 'Aún nada cerrado' };
            const items = buckets[colKey];
            return (
              <div key={colKey} className="col" data-col={colKey}>
                <div className="col-header">
                  <span className="col-title">
                    <span className="col-dot" />
                    {labels[colKey]}
                  </span>
                  <span className="col-actions">
                    {colKey === 'done' && (
                      <button className="archive-all" onClick={archiveAllDone} disabled={items.length === 0} title="Archivar todas las tarjetas de Hecho">
                        Archivar todos
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
                      <div key={c.id} className={`card${c.waitingForMe ? ' waiting' : ''}${lastSeenTs && parseFloat(c.ts) > lastSeenTs ? ' is-new' : ''}`} onClick={() => openModal(c)}>
                        <div className="card-meta">
                          <span className="left">
                            <span className={`cat-tag ${c.category.key}`}>
                              <span className="dot" />
                              {c.category.key === 'acceso' ? 'Acceso' : c.category.key === 'reembolso' ? 'Reembolso' : 'Otro'}
                            </span>
                            <span className="channel-tag">#{channelLabel(c.channelId)}</span>
                          </span>
                          <span className={age.cls}>{age.text}</span>
                        </div>
                        <div className="card-title">{c.title}</div>
                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                          <a className="btn btn-primary" href={c.deepLink || c.link} target="slack-thread" rel="noopener noreferrer">Ver hilo</a>
                          {colKey === 'todo' && (
                            <>
                              <button className="btn" onClick={() => setCaseStatus(c.id, 'doing')}>En progreso</button>
                              <button className="btn btn-done" onClick={() => setCaseStatus(c.id, 'done')}>Hecho</button>
                            </>
                          )}
                          {colKey === 'doing' && (
                            <>
                              <button className="btn btn-back" onClick={() => setCaseStatus(c.id, 'todo')}>Por revisar</button>
                              <button className="btn btn-done" onClick={() => setCaseStatus(c.id, 'done')}>Hecho</button>
                            </>
                          )}
                          {colKey === 'done' && (
                            <>
                              <button className="btn btn-back" onClick={() => setCaseStatus(c.id, 'doing')}>Reabrir</button>
                              <button className="btn btn-back" onClick={() => archiveCase(c.id)}>Archivar</button>
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

      {undoAction && (
        <div className="undo-bar">
          <span className="undo-label">{undoAction.label}</span>
          <button onClick={undoAction.run}>Deshacer</button>
          <button className="close" onClick={() => setUndoAction(null)} aria-label="Cerrar">×</button>
        </div>
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
              <span style={{ flex: 1 }} />
              {(() => {
                const cur = state.cases[modalCase.id]?.status || 'todo';
                const doAction = (newStatus) => { setCaseStatus(modalCase.id, newStatus); closeModal(); };
                const doArchive = () => { archiveCase(modalCase.id); closeModal(); };
                return (
                  <>
                    {cur === 'todo' && (
                      <>
                        <button className="btn" onClick={() => doAction('doing')}>▶ En progreso</button>
                        <button className="btn btn-done" onClick={() => doAction('done')}>✓ Hecho</button>
                      </>
                    )}
                    {cur === 'doing' && (
                      <>
                        <button className="btn btn-back" onClick={() => doAction('todo')}>← Por revisar</button>
                        <button className="btn btn-done" onClick={() => doAction('done')}>✓ Hecho</button>
                      </>
                    )}
                    {cur === 'done' && (
                      <>
                        <button className="btn btn-back" onClick={() => doAction('doing')}>↩ Reabrir</button>
                        <button className="btn btn-back" onClick={doArchive}>🗑 Archivar</button>
                      </>
                    )}
                  </>
                );
              })()}
              <button className="btn" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
