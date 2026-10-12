import { NextResponse } from 'next/server';
import { slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-haiku-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `Eres un asistente para Joan Anton Torelló (COO de Instituto de Comunicación — ICO).
Tu tarea: leer un hilo de Slack sobre una incidencia de ventas/pagos y clasificar su estado actual.

Equipo (user IDs entre paréntesis):
- Joan Anton Torelló — U08N1C4B9PC — COO. Decide, aprueba, crea enlaces de pago.
- Lautaro Schenfeld — U0B102S2N6Q — técnico, sustituye a Joan en vacaciones.
- Sílvia — U07D4H2BEH4 — gestiona reembolsos y gestión económica.
- Alex, Marco, Alba, Adrià: closers/setters que reportan incidencias de sus leads.

Clasifica en EXACTAMENTE UNA de estas 3 opciones:

1. "RESUELTO" — El hilo está cerrado. Evidencias claras:
   - Un responsable (Joan, Lautaro, Sílvia) ya dio respuesta definitiva Y el cliente/compañero contestó con agradecimiento ("gracias", "perfecto", "ya está", "muchas gracias").
   - O Sílvia confirma que lo tramitó.
   - O el link/acción pedida ya se ha compartido y el solicitante confirmó recepción.

2. "ESPERA_JOAN" — Necesita acción de Joan o Lautaro:
   - Último mensaje es una petición dirigida a Joan sin responder.
   - Hay que crear algo (enlace, acceso), aprobar, o tomar una decisión.

3. "ESPERA_CLIENTE" — Ya se le respondió, esperamos su contestación:
   - Joan/Lautaro/Sílvia respondió con una pregunta o acción pedida al cliente y éste no ha contestado.
   - El hilo lleva días sin respuesta del cliente tras una pregunta/propuesta nuestra.

Nivel de confianza:
- "high" — señales clarísimas (ej. "gracias" explícito + acción tramitada).
- "medium" — señales presentes pero interpretativas.
- "low" — ambiguo, mejor que Joan lo revise.

Responde SOLO con un objeto JSON válido, nada más:
{"verdict":"RESUELTO|ESPERA_JOAN|ESPERA_CLIENTE","confidence":"high|medium|low","reason":"frase corta (max 80 chars) explicando por qué"}`;

function cleanSlackText(s) {
  return String(s || '')
    .replace(/<@U[A-Z0-9]+>/g, '@usuario')
    .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

async function fetchThreadForAnalysis(channel, ts) {
  const data = await slackFetch('conversations.replies', { channel, ts, limit: 100 });
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  return msgs.map(m => ({
    user: m.user || 'bot',
    ts: m.ts,
    text: cleanSlackText(m.text || ''),
  }));
}

async function callClaude(apiKey, threadText) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Hilo:\n---\n${threadText}\n---` }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  // Extraer el primer JSON del texto
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`respuesta sin JSON: ${text.slice(0, 100)}`);
  const parsed = JSON.parse(match[0]);
  return {
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    reason: parsed.reason,
  };
}

async function analyzeOne(apiKey, { channelId, ts }) {
  try {
    const msgs = await fetchThreadForAnalysis(channelId, ts);
    if (msgs.length === 0) {
      return { channelId, ts, error: 'thread vacío o inaccesible' };
    }
    const threadText = msgs.map((m, i) =>
      `[${i + 1}] <@${m.user}>: ${m.text}`.slice(0, 1500)
    ).join('\n');
    const result = await callClaude(apiKey, threadText);
    return { channelId, ts, ...result };
  } catch (e) {
    return { channelId, ts, error: String(e.message || e) };
  }
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const cases = Array.isArray(body.cases) ? body.cases.slice(0, 10) : [];
  if (cases.length === 0) {
    return NextResponse.json({ error: 'cases array requerido (máx 10 por batch)' }, { status: 400 });
  }
  // Concurrencia dentro del batch para rapidez (~5 paralelos)
  const results = [];
  const CONC = 5;
  let i = 0;
  async function worker() {
    while (i < cases.length) {
      const idx = i++;
      results[idx] = await analyzeOne(apiKey, cases[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, cases.length) }, worker));
  return NextResponse.json({ ok: true, results });
}
