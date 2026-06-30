import { NextResponse } from 'next/server';
import { getState, applyPatches, isKvEnabled } from '../../lib/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → { enabled: bool, cases: {} }
export async function GET() {
  if (!isKvEnabled()) {
    return NextResponse.json({ enabled: false, cases: {} }, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const state = await getState();
    return NextResponse.json({ enabled: true, cases: state?.cases || {} }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ enabled: false, error: String(e.message || e), cases: {} }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

// POST { patches: [{caseId, patch}, ...] } → aplica todos los patches y
// devuelve el state completo resultante. Usado tanto para cambios
// individuales (1 patch) como bulk (archivar todos / auto-promote).
export async function POST(req) {
  if (!isKvEnabled()) {
    return NextResponse.json({ enabled: false, error: 'KV not configured' }, { status: 503 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const patches = Array.isArray(body.patches) ? body.patches : null;
  if (!patches) {
    return NextResponse.json({ error: 'patches array required' }, { status: 400 });
  }
  try {
    const state = await applyPatches(patches);
    return NextResponse.json({ enabled: true, cases: state?.cases || {} }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: String(e.message || e) }, { status: 500 });
  }
}
