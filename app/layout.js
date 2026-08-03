export const metadata = {
  title: 'Pipeline de Incidencias',
  description: 'Dashboard de hilos pendientes en Slack',
};

// Critical CSS inline en el <head> para evitar el flash antes de que
// se apliquen los estilos del componente.
const BASE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f5f7fb; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif; font-size: 13px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { margin: 0; }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
