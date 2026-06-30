// Wrapper minimal sobre Upstash Redis REST (lo que Vercel KV expone).
// Si las env vars no están, isKvEnabled() devuelve false y el frontend
// cae a localStorage (cada navegador su Kanban como antes).
const URL_ENV = 'KV_REST_API_URL';
const TOKEN_ENV = 'KV_REST_API_TOKEN';
const STATE_KEY = 'pipeline-state';

export function isKvEnabled() {
  return !!(process.env[URL_ENV] && process.env[TOKEN_ENV]);
}

async function kvCommand(parts) {
  const url = `${process.env[URL_ENV]}/${parts.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env[TOKEN_ENV]}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV ${parts[0]} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function kvSetJson(key, value) {
  // SET via POST body para evitar problemas de tamaño en la URL.
  const url = `${process.env[URL_ENV]}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env[TOKEN_ENV]}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV set ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getState() {
  if (!isKvEnabled()) return null;
  const r = await kvCommand(['get', STATE_KEY]);
  if (!r || r.result == null) return { cases: {} };
  try {
    const parsed = typeof r.result === 'string' ? JSON.parse(r.result) : r.result;
    return parsed && typeof parsed === 'object' ? parsed : { cases: {} };
  } catch (e) {
    return { cases: {} };
  }
}

export async function applyPatches(patches) {
  if (!isKvEnabled()) return null;
  const state = (await getState()) || { cases: {} };
  if (!state.cases) state.cases = {};
  for (const { caseId, patch } of patches) {
    if (!caseId || !patch || typeof patch !== 'object') continue;
    state.cases[caseId] = { ...(state.cases[caseId] || {}), ...patch };
  }
  await kvSetJson(STATE_KEY, state);
  return state;
}
