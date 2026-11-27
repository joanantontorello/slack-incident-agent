import { NextResponse } from 'next/server';
import { analyzeMany } from '../../lib/classify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const results = await analyzeMany(apiKey, cases);
  return NextResponse.json({ ok: true, results });
}
