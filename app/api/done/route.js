import { NextResponse } from 'next/server';
import { slackFetch, hasUserToken } from '../../lib/slack';

export const runtime = 'nodejs';

// Marca un hilo como hecho en Slack:
// 1) Añade reacción ✅ al mensaje raíz (bot, scope reactions:write).
// 2) Si hay SLACK_USER_TOKEN, llama conversations.mark con el ts del
//    último mensaje del hilo para limpiar el unread del canal.
// Tolerante a fallos parciales: nunca devuelve 500.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const { channel, ts, undo = false } = body;
  if (!channel || !ts) {
    return NextResponse.json({ ok: false, error: 'missing channel or ts' }, { status: 400 });
  }

  const result = { reaction: null, mark: null, reactionAs: null };

  // 1) Reacción. Si hay user token, la pone Joan (aparece como su user);
  //    si no, la pone el bot.
  const useUserForReaction = hasUserToken();
  result.reactionAs = useUserForReaction ? 'user' : 'bot';
  try {
    await slackFetch(undo ? 'reactions.remove' : 'reactions.add', {
      channel,
      timestamp: ts,
      name: 'white_check_mark',
    }, { useUserToken: useUserForReaction });
    result.reaction = 'ok';
  } catch (e) {
    const msg = String(e.message || e);
    // already_reacted / no_reaction son éxitos idempotentes
    if (/already_reacted|no_reaction/.test(msg)) {
      result.reaction = 'noop';
    } else {
      result.reaction = msg;
    }
  }

  // 2) Mark as read (user token, opcional)
  if (!undo && hasUserToken()) {
    try {
      // Obtenemos el ts del último mensaje del hilo para marcar hasta ahí.
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
  } else if (!undo) {
    result.mark = 'skipped (no SLACK_USER_TOKEN)';
  }

  return NextResponse.json({ ok: true, ...result });
}
