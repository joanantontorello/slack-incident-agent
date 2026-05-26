'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      maxWidth: 720,
      margin: '40px auto',
    }}>
      <h1 style={{ color: '#b91c1c', fontSize: 18 }}>⚠️ Algo se rompió</h1>
      <p style={{ color: '#374151', fontSize: 14 }}>
        Mira la consola del navegador (F12 → Console) para el detalle.
      </p>
      <pre style={{
        background: '#fef2f2',
        color: '#991b1b',
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>{String(error?.message || error)}</pre>
      <button
        onClick={() => reset()}
        style={{
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 13,
          cursor: 'pointer',
          marginTop: 12,
        }}
      >Reintentar</button>
    </div>
  );
}
