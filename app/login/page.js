'use client';

import { useEffect, useState } from 'react';

const STYLES = `
  .login-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(180deg, #f0f6ff 0%, #f5f7fb 60%, #f5f7fb 100%); }
  .login-card { background: #fff; border-radius: 18px; padding: 40px 36px 32px; width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04); text-align: center; }
  .login-logo { width: 56px; height: 56px; object-fit: contain; margin: 0 auto 16px; display: block; }
  .login-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.3px; }
  .login-subtitle { font-size: 13px; color: #64748b; margin-bottom: 28px; }
  .field { text-align: left; margin-bottom: 14px; }
  .field label { display: block; font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 6px; }
  .field input { width: 100%; background: #f1f5f9; border: none; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: #0f172a; outline: none; transition: box-shadow 0.15s, background 0.15s; }
  .field input:focus { background: #fff; box-shadow: 0 0 0 2px #0068FF; }
  .login-btn { width: 100%; background: #0068FF; color: #fff; border: none; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 6px; transition: background 0.15s; box-shadow: 0 2px 6px rgba(0,104,255,0.25); }
  .login-btn:hover { background: #0052cc; }
  .login-btn:disabled { opacity: 0.5; cursor: wait; }
  .login-error { background: #fef2f2; color: #991b1b; font-size: 12.5px; padding: 10px 12px; border-radius: 8px; margin-top: 12px; }
  .login-footer { margin-top: 20px; font-size: 11.5px; color: #94a3b8; }
`;

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState('/');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const n = params.get('next');
      if (n && n.startsWith('/')) setNext(n);
    } catch (e) {}
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'No se pudo iniciar sesión');
        setBusy(false);
        return;
      }
      window.location.href = next;
    } catch (err) {
      setError(String(err.message || err));
      setBusy(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="login-shell">
        <form className="login-card" onSubmit={submit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="login-logo" src="https://comisiones-app-inky.vercel.app/static/logo-ico.png" alt="ICO" />
          <h1 className="login-title">Pipeline de Incidencias</h1>
          <p className="login-subtitle">Introduce tus credenciales para continuar</p>

          <div className="field">
            <label htmlFor="user">Usuario</label>
            <input
              id="user"
              type="text"
              autoComplete="username"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pass">Contraseña</label>
            <input
              id="pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>

          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          {error && <div className="login-error">{error}</div>}

          <div className="login-footer">Instituto de Comunicación · Uso interno</div>
        </form>
      </div>
    </>
  );
}
