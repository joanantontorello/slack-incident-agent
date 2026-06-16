import { NextResponse } from 'next/server';
import { slackFetch, hasUserToken } from '../../lib/slack';

export const runtime = 'nodejs';

// Añade / quita una reacción de emoji al mensaje raíz de un hilo.
// Si markRead=true (y hay user token) marca el canal como leído hasta
// el último mensaje del hilo. Si SLACK_USER_TOKEN existe, la reacción
// la postea el user (aparece como Joan Anton); si no, el bot.
// Body: { channel, ts, emoji='white_check_mark', undo=false, markRead=false }
// Tolerante a fallos parciales: nunca devuelve 500.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const { channel, ts, emoji = 'white_check_mark', undo = false, markRead = false } = body;
  if (!channel || !ts) {
    return NextResponse.json({ ok: false, error: 'missing channel or ts' }, { status: 400 });
  }

  const result = { reaction: null, mark: null, reactionAs: null, emoji };

  const useUserForReaction = hasUserToken();
  result.reactionAs = useUserForReaction ? 'user' : 'bot';
  try {
    await slackFetch(undo ? 'reactions.remove' : 'reactions.add', {
      channel,
      timestamp: ts,
      name: emoji,
    }, { useUserToken: useUserForReaction });
    result.reaction = 'ok';
  } catch (e) {
    const msg = String(e.message || e);
    if (/already_reacted|no_reaction/.test(msg)) {
      result.reaction = 'noop';
    } else {
      result.reaction = msg;
    }
  }

  if (markRead && !undo && hasUserToken()) {
    try {
      let markTs = ts;
      try {
        const tr = await slackFetch('conversations.replies', { channel, ts, limit: 200 });
        const msgs = Array.isArray(tr.messages) ? tr.messages : [];
        if (msgs.length > 0) markTs = msgs[msgs.length - 1].ts || ts;
      } catch (e) {}
      await slackFetch('conversations.mark', { channel, ts: markTs }, { useUserToken: true });
      result.mark = 'ok';
    } catch (e) {
      result.mark = String(e.message || e);
    }
  } else if (markRead && !undo) {
    result.mark = 'skipped (no SLACK_USER_TOKEN)';
  }

  return NextResponse.json({ ok: true, ...result });
}
