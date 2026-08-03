'use client';

import { useEffect, useState } from 'react';

const STYLES = `
  .admin-shell { min-height: 100vh; background: #f5f7fb; }
  .admin-top { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 14px 22px; display: flex; align-items: center; justify-content: space-between; }
  .admin-brand { display: flex; align-items: center; gap: 12px; }
  .admin-brand img { width: 36px; height: 36px; }
  .admin-brand h1 { margin: 0; font-size: 15px; font-weight: 600; color: #0f172a; }
  .admin-brand .sub { font-size: 11.5px; color: #64748b; }
  .admin-back { background: #fff; color: #0f172a; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; text-decoration: none; box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04); }
  .admin-back:hover { background: #f8fafc; }
  .admin-wrap { max-width: 720px; margin: 0 auto; padding: 32px 22px 60px; }
  .card { background: #fff; border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 3px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.03); margin-bottom: 20px; }
  .card h2 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px; }
  .card .h-sub { font-size: 12.5px; color: #64748b; margin-bottom: 20px; }
  .user-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid #f1f5f9; }
  .user-row:first-of-type { border-top: none; }
  .user-name { font-weight: 600; color: #0f172a; font-size: 13.5px; min-width: 140px; }
  .user-pass { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; flex: 1; letter-spacing: 0.5px; user-select: all; }
  .user-tag { font-size: 10.5px; padding: 3px 8px; border-radius: 999px; background: #eef2f7; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
  .user-tag.env { background: #fef3c7; color: #92400e; }
  .user-actions { display: flex; gap: 6px; }
  .user-btn { background: transparent; border: none; color: #64748b; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.15s; }
  .user-btn:hover { background: #f1f5f9; color: #0f172a; }
  .user-btn.danger:hover { background: #fee2e2; color: #b91c1c; }
  .form-row { display: flex; gap: 10px; align-items: flex-end; margin-top: 16px; }
  .field { flex: 1; }
  .field label { display: block; font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  .field input { width: 100%; background: #f1f5f9; border: none; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #0f172a; outline: none; transition: box-shadow 0.15s, background 0.15s; }
  .field input:focus { background: #fff; box-shadow: 0 0 0 2px #0068FF; }
  .add-btn { background: #0068FF; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px rgba(0,104,255,0.25); }
  .add-btn:hover { background: #0052cc; }
  .add-btn:disabled { opacity: 0.5; cursor: wait; }
  .note { background: #fef3c7; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 12.5px; margin-top: 12px; }
  .error { background: #fef2f2; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-size: 12.5px; margin-top: 12px; }
  .empty { color: #94a3b8; font-size: 13px; padding: 12px 0; font-style: italic; }
  .copied-tag { color: #047857; font-size: 11px; margin-left: 8px; }
`;

export default function AdminPage() {
  const [envUsers, setEnvUsers] = useState([]);
  const [kvUsers, setKvUsers] = useState([]);
  const [kvEnabled, setKvEnabled] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await r.json();
      setEnvUsers(data.envUsers || []);
      setKvUsers(data.kvUsers || []);
      setKvEnabled(!!data.kvEnabled);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!newUser.trim() || !newPass) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: newUser.trim(), pass: newPass }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error añadiendo usuario');
      setNewUser(''); setNewPass('');
      await load();
    } catch (err) {
      setError(String(err.message || err));
    }
    setBusy(false);
  };

  const remove = async (user) => {
    if (!confirm(`¿Quitar acceso al usuario "${user}"? Su cookie dejará de valer en ~1 min.`)) return;
    setError('');
    try {
      const r = await fetch(`/api/admin/users?user=${encodeURIComponent(user)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error || 'Error');
      await load();
    } catch (err) {
      setError(String(err.message || err));
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch (e) {}
  };

  const genPass = () => {
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const arr = new Uint32Array(14);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    for (const n of arr) out += alpha[n % alpha.length];
    setNewPass(out);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="admin-shell">
        <div className="admin-top">
          <div className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://comisiones-app-inky.vercel.app/static/logo-ico.png" alt="ICO" />
            <div>
              <h1>Gestión de usuarios</h1>
              <div className="sub">Pipeline de Incidencias · Solo administradores</div>
            </div>
          </div>
          <a className="admin-back" href="/">← Volver al dashboard</a>
        </div>

        <div className="admin-wrap">
          <div className="card">
            <h2>Usuarios con acceso</h2>
            <div className="h-sub">Cualquiera con estas credenciales puede entrar al dashboard.</div>

            {envUsers.map(u => (
              <div key={u.user} className="user-row">
                <div className="user-name">{u.user}</div>
                <div className="user-pass" onClick={() => copy(u.pass, u.user)} title="Clic para copiar">
                  {u.pass}
                  {copied === u.user && <span className="copied-tag">✓ copiado</span>}
                </div>
                <span className="user-tag env">Sistema</span>
              </div>
            ))}

            {kvUsers.map(u => (
              <div key={u.user} className="user-row">
                <div className="user-name">{u.user}</div>
                <div className="user-pass" onClick={() => copy(u.pass, u.user)} title="Clic para copiar">
                  {u.pass}
                  {copied === u.user && <span className="copied-tag">✓ copiado</span>}
                </div>
                <div className="user-actions">
                  <button className="user-btn danger" onClick={() => remove(u.user)}>Eliminar</button>
                </div>
              </div>
            ))}

            {envUsers.length === 0 && kvUsers.length === 0 && (
              <div className="empty">No hay usuarios configurados.</div>
            )}
          </div>

          <div className="card">
            <h2>Añadir usuario</h2>
            <div className="h-sub">Se guarda en Vercel KV — disponible sin redeploy en 1 minuto.</div>
            <form className="form-row" onSubmit={add}>
              <div className="field">
                <label>Usuario</label>
                <input
                  type="text"
                  value={newUser}
                  onChange={e => setNewUser(e.target.value)}
                  placeholder="ej. lautaro"
                  required
                />
              </div>
              <div className="field">
                <label>Contraseña <button type="button" onClick={genPass} style={{ background: 'none', border: 'none', color: '#0068FF', cursor: 'pointer', fontSize: 11, marginLeft: 8, padding: 0 }}>generar</button></label>
                <input
                  type="text"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="contraseña"
                  required
                />
              </div>
              <button type="submit" className="add-btn" disabled={busy}>{busy ? 'Añadiendo…' : 'Añadir'}</button>
            </form>
            {error && <div className="error">{error}</div>}
            {!kvEnabled && (
              <div className="note">
                ⚠️ Vercel KV no está configurado. Solo funcionan los usuarios de sistema (env vars).
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
