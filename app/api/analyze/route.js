import { NextResponse } from 'next/server';
import { slackFetch } from '../../lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Modelo configurable vía env ANTHROPIC_MODEL. Default Sonnet 5.5:
// mejor sweet spot calidad/coste para clasificar hilos en castellano.
// Alternativas: claude-haiku-5-5 (más barato) · claude-opus-5-5 (overkill).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `Eres el filtro inteligente de la bandeja de incidencias de Joan Anton Torelló (COO de Instituto de Comunicación — ICO).

TU ÚNICA PREGUNTA: ¿Joan necesita hacer o decidir algo con este hilo AHORA?

El dashboard de Joan sirve para no perder cosas donde SU acción es necesaria. No le interesan los hilos donde el equipo ya se autogestionó ni los que están en manos de otro compañero. Solo quiere ver los suyos.

Equipo (user IDs entre paréntesis):
- Joan Anton Torelló — U08N1C4B9PC — COO. Autoridad final, aprueba, crea enlaces de pago especiales, resuelve dudas estratégicas.
- Lautaro Schenfeld — U0B102S2N6Q — técnico, le sustituye en vacaciones. Puede resolver muchas cosas por su cuenta.
- Sílvia Lema — U07D4H2BEH4 — gestión económica. Hace reembolsos, cobros, reconciliación. Autosuficiente en lo suyo.
- Alex, Marco, Alba, Adrià, Lory, Sergio y otros: closers/setters/equipo que reportan incidencias de sus leads o piden cosas.

Clasifica en EXACTAMENTE UNA de estas 3 opciones:

1. "RESUELTO" — Joan no necesita hacer nada. Casos típicos:
   - Alguien del equipo (Sílvia, Lautaro, otro compañero) ya respondió con la solución/información y el tema queda cerrado, aunque NO haya un "gracias" explícito al final.
   - La última respuesta útil resuelve la duda planteada (ej. "sí, puedes", "ya lo he hecho", "la encuentras en X", enlace compartido).
   - El propio solicitante dice que ya se solucionó, que ya lo encontró, que ya le han contestado por otra vía.
   - Sílvia confirma reembolso tramitado o cobro realizado.
   - La petición original ya tiene respuesta aceptable y han pasado días sin más actividad.
   - Sé GENEROSO con RESUELTO. Si leyendo el hilo tú NO sabrías qué más añadir como Joan → es RESUELTO.

2. "ESPERA_JOAN" — Joan tiene que hacer algo concreto. SOLO estos casos:
   - Le mencionan DIRECTAMENTE con una petición explícita que requiere su autoridad (crear enlace de pago, aprobar excepción, decisión estratégica) y nadie más del equipo ha respondido todavía.
   - Alguien del equipo deriva explícitamente a Joan ("mejor que lo veas tú", "@Joan necesito tu OK").
   - Pregunta técnica/estratégica donde Lautaro/Sílvia dicen que no saben o esperan la respuesta de Joan.

3. "EN_CURSO" — Alguien del equipo lo está gestionando pero aún no está cerrado del todo:
   - Sílvia dice "le escribo yo" / "me ocupo" sin confirmar aún tramitado.
   - Lautaro o un compañero propuso una acción y esperan verificación/respuesta del cliente externo.
   - Hay seguimiento activo entre compañeros pero sin cierre.
   - Joan NO necesita intervenir salvo que pase mucho tiempo sin movimiento.

REGLA DE ORO: ante la duda entre RESUELTO y EN_CURSO, elige RESUELTO. Ante la duda entre EN_CURSO y ESPERA_JOAN, elige EN_CURSO. ESPERA_JOAN solo si está CLARO que la pelota está en su tejado y nadie más puede moverla.

Confianza:
- "high" — señales muy claras (acción tramitada, respuesta cerrando, mención explícita a Joan).
- "medium" — razonablemente seguro pero cabe interpretación.
- "low" — ambiguo. (Si tienes que elegir low, probablemente la opción correcta es RESUELTO o EN_CURSO, no ESPERA_JOAN).

Responde SOLO con un objeto JSON válido, nada más:
{"verdict":"RESUELTO|ESPERA_JOAN|EN_CURSO","confidence":"high|medium|low","reason":"frase corta (max 80 chars) explicando por qué"}`;

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
