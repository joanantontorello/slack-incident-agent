// Helper for calling Slack Web API
const SLACK_API = 'https://slack.com/api';

export async function slackFetch(method, params, { useUserToken = false } = {}) {
  const token = useUserToken
    ? process.env.SLACK_USER_TOKEN
    : process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error(`${useUserToken ? 'SLACK_USER_TOKEN' : 'SLACK_BOT_TOKEN'} env var not configured`);
  }
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack ${method} failed: ${data.error || 'unknown'}`);
  }
  return data;
}

export function hasUserToken() {
  return Boolean(process.env.SLACK_USER_TOKEN);
}

export function getChannelsConfig() {
  const raw = process.env.SLACK_CHANNELS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const [id, filter] = entry.split(':');
    return { id, filter: filter || 'all' };
  });
}

export function getMyUserId() {
  return process.env.MY_USER_ID || '';
}

// Lista de user IDs cuyas reacciones ✅ en Slack auto-mueven el hilo
// a "Hecho" en el dashboard. Formato env: "U08N1C4B9PC,U0B102S2N6Q".
// Si no está seteado, fallback a solo MY_USER_ID.
export function getAutoDoneUserIds() {
  const raw = process.env.AUTO_DONE_USER_IDS || '';
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length > 0) return ids;
  const me = getMyUserId();
  return me ? [me] : [];
}
