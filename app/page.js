'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'pipeline_incidencias_v1';
const SLACK_WORKSPACE_FALLBACK = 'https://slack.com/app_redirect';

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

function shortenText(s, n) {
  if (!s) return '';
  s = s.replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1')
       .replace(/<tel:[^|>]+\|([^>]+)>/g, '$1')
       .replace(/<@[^|>]+\|([^>]+)>/g, '@$1')
       .replace(/<@[A-Z0-9]+>/g, '')
       .replace(/<!channel>/g, '@channel')
       .replace(/[:_]/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function extractTitle(text) {
  const cleaned = shortenText(text, 200);
  const lines = cleaned.split(/\n|—|\*/).filter(l => l.trim().length > 3);
  return lines.length > 0 ? shortenText(lines[0], 90) : shortenText(cleaned, 90);
}

function buildSlackLink(channelId, ts) {
  return `${SLACK_WORKSPACE_FALLBACK}?channel=${channelId}&message_ts=${ts}`;
}

// ============ MAIN COMPONENT ============
export default function Page() {
  const [cases, setCases] = useState([]);
  const [state, setState] = useState({ cases: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [config, setConfig] = useState({ myUserId: '', channels: [] });
  const [progress, setProgress] = useState('');

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
      msgsRes.channels.forEach(c => c.messages.forEach(m => { if (m.user) userIdsToResolve.add(m.user); }));

      // Identify candidate threads (with replies, or for "mention" channel: any message mentioning me)
      const threadFetches = [];
      for (const c of msgsRes.channels) {
        for (const m of c.messages) {
          const mentionsMe = myId && (m.text.includes(myId));
          const isFromMe = m.user === myId;
          if (c.filter === 'mention') {
            if (m.reply_count > 0 || mentionsMe || isFromMe) {
              threadFetches.push({ channel: c.id, ts: m.ts, root: m, channelFilter: c.filter });
            }
          } else if (m.reply_count > 0) {
            threadFetches.push({ channel: c.id, ts: m.ts, root: m, channelFilter: c.filter });
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

          allCases.push({
            id: `${f.channel}-${f.ts}`,
            channelId: f.channel,
            ts: f.ts,
            title: extractTitle(rootText) || '(sin título)',
            summary: shortenText(rootText, 180),
            lastUser: users[lastUserId] || lastUserId || 'desconocido',
            lastText: shortenText(lastText, 150),
            category: categorize(allText),
            waitingForMe,
            link: buildSlackLink(f.channel, f.ts),
            replyCount: replies.length,
          });
        } catch (err) {
          console.error('Error procesando hilo', tr && tr.f, err);
        }
      }

      setCases(allCases);
      setLoading(false);
      setProgress('');
    } catch (e) {
      setError(e.message || String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const setCaseStatus = (caseId, status) => {
    const s = { ...state, cases: { ...state.cases, [caseId]: { ...(state.cases[caseId] || {}), status, ...(status === 'done' ? { doneAt: Date.now() } : {}) } } };
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
  const filtered = cases.filter(c => activeFilter === 'all' || c.channelId === activeFilter);
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
        .refresh-btn { background: #4f46e5; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
        .refresh-btn:disabled { opacity: 0.5; cursor: wait; }
        .board { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 12px; min-height: calc(100vh - 60px); }
        @media (max-width: 800px) { .board { grid-template-columns: 1fr; } }
        .col { background: #f1f3f7; border-radius: 10px; padding: 8px; display: flex; flex-direction: column; min-width: 0; }
        .col-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
        .col-header .count { background: #fff; border-radius: 10px; padding: 1px 8px; font-size: 11px; color: #555; }
        .col[data-col="todo"] .col-header { color: #b91c1c; }
        .col[data-col="doing"] .col-header { color: #c2410c; }
        .col[data-col="done"] .col-header { color: #15803d; }
        .cards { display: flex; flex-direction: column; gap: 6px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; box-shadow: 0 1px 1px rgba(0,0,0,0.03); }
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
                  <span className="count">{items.length}</span>
                </div>
                <div className="cards">
                  {items.length === 0 ? (
                    <div className="empty">{empties[colKey]}</div>
                  ) : items.map(c => {
                    const age = ageFromTs(c.ts);
                    return (
                      <div key={c.id} className="card">
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
                        <div className="card-actions">
                          <a className="btn btn-primary" href={c.link} target="_blank" rel="noopener noreferrer">💬 Ver hilo</a>
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
    </>
  );
}
