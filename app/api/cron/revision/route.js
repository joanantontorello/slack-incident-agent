import { NextResponse } from 'next/server';
import { runSweep } from '../../../lib/sweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Revisión automática de lunes a viernes a las 16:00 de Madrid.
// Vercel Cron va en hora UTC: vercel.json la llama a las 14:00 y a las 15:00 UTC
// y aquí solo se hace la que cae en las 16 h de Madrid (así da igual el cambio
// de hora de marzo y octubre). Además, como mucho una vez al día.
// No necesita contraseña: fuera de esa hora no hace nada.
// ?dry=1 → solo cuenta hilos (no clasifica ni lanza nada), para comprobar.
const RUN_HOUR = 16;
const LAST_KEY = 'pipeline-auto-sweep-last';

function madridNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { weekday: parts.weekday, hour: parseInt(parts.hour, 10), date: `${parts.year}-${parts.month}-${parts.day}` };
}

async function kv(parts, body) {
  const url = `${process.env.KV_REST_API_URL}/${parts.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    body, cache: 'no-store',
  });
  return res.json();
}

export async function GET(req) {
  const url = new URL(req.url);
  const origin = url.origin;
  if (url.searchParams.get('dry') === '1') {
    try { return NextResponse.json(await runSweep(origin, { dry: true })); }
    catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
  }

  const secret = process.env.CRON_SECRET;
  const bySecret = secret && req.headers.get('authorization') === `Bearer ${secret}`;
  const now = madridNow();
  const workday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(now.weekday);
  if (!bySecret && !(workday && now.hour === RUN_HOUR)) {
    return NextResponse.json({ skipped: `fuera de hora (${now.weekday} ${now.hour} h en Madrid)` });
  }
  // Una sola vez al día (SET … NX con caducidad de 2 días)
  const lock = await kv(['set', `pipeline-auto-sweep:${now.date}`, String(Date.now()), 'NX', 'EX', '172800']);
  if (lock.result !== 'OK') return NextResponse.json({ skipped: 'ya se hizo hoy' });

  try {
    const summary = await runSweep(origin);
    await kv(['set', LAST_KEY], JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const err = { at: Date.now(), error: String(e.message || e).slice(0, 300) };
    await kv(['set', LAST_KEY], JSON.stringify(err)).catch(() => {});
    return NextResponse.json(err, { status: 500 });
  }
}
