export const metadata = {
  title: 'Pipeline Incidencias Ventas',
  description: 'Dashboard de hilos pendientes en Slack',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
