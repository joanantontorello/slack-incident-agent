export const metadata = { title: 'Manual — Pipeline Incidencias' };

export default function ManualPage() {
  return (
    <>
      <style>{`
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          color: #1f2937; background: #f8fafc;
          line-height: 1.6;
        }
        .top {
          background: #fff; border-bottom: 1px solid #e5e7eb;
          padding: 10px 20px; display: flex; align-items: center;
          justify-content: space-between; position: sticky; top: 0; z-index: 10;
        }
        .top a { color: #4f46e5; text-decoration: none; font-weight: 500; font-size: 13px; }
        .top a:hover { text-decoration: underline; }
        .top .brand { color: #111; font-weight: 600; font-size: 14px; }
        .wrap { max-width: 780px; margin: 0 auto; padding: 32px 20px 60px; }
        h1 {
          font-size: 28px; font-weight: 700; margin: 0 0 6px; color: #0f172a;
          letter-spacing: -0.5px;
        }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 32px; }
        h2 {
          font-size: 20px; font-weight: 700; margin: 36px 0 12px; color: #0f172a;
          padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;
        }
        h3 {
          font-size: 16px; font-weight: 700; margin: 24px 0 8px; color: #1e293b;
        }
        h4 {
          font-size: 14px; font-weight: 700; margin: 18px 0 6px; color: #334155;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        p, li { font-size: 14.5px; }
        ol, ul { padding-left: 22px; }
        li { margin: 4px 0; }
        code {
          background: #eef2ff; color: #4338ca; padding: 1px 6px;
          border-radius: 4px; font-size: 13px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        blockquote {
          border-left: 3px solid #a5b4fc; background: #eef2ff;
          padding: 10px 14px; margin: 10px 0; border-radius: 4px;
          font-size: 13.5px; color: #3730a3;
        }
        blockquote code { background: #c7d2fe; color: #312e81; }
        table {
          width: 100%; border-collapse: collapse; margin: 12px 0;
          font-size: 13.5px;
        }
        th, td {
          text-align: left; padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        th { background: #f8fafc; font-weight: 600; color: #334155; }
        tr:last-child td { border-bottom: none; }
        .callout {
          background: #fef3c7; border-left: 4px solid #f59e0b;
          padding: 12px 16px; border-radius: 6px; margin: 20px 0;
          font-size: 14px; color: #78350f;
        }
        .callout.info { background: #dbeafe; border-color: #3b82f6; color: #1e3a8a; }
        .callout.ok { background: #d1fae5; border-color: #10b981; color: #065f46; }
        .step {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 14px 18px; margin: 12px 0;
        }
        .step h4 { margin-top: 0; }
        .step.reembolso { border-left: 4px solid #f97316; }
        .step.acceso { border-left: 4px solid #dc2626; }
        .step.otro { border-left: 4px solid #4338ca; }
        .badge {
          display: inline-block; padding: 2px 8px; border-radius: 10px;
          font-size: 11px; font-weight: 600; margin-right: 6px;
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .badge-reembolso { background: #ffedd5; color: #c2410c; }
        .badge-acceso { background: #fee2e2; color: #b91c1c; }
        .badge-otro { background: #e0e7ff; color: #4338ca; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }
        .footer-note {
          margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;
          font-size: 12px; color: #94a3b8; text-align: center;
        }
        .footer-note a { color: #64748b; }
      `}</style>

      <div className="top">
        <span className="brand">📋 Pipeline Incidencias — Manual</span>
        <a href="/">← Volver al dashboard</a>
      </div>

      <div className="wrap">
        <h1>Manual de uso</h1>
        <p className="subtitle">
          Dashboard interno para gestionar las incidencias que entran por Slack sin
          perder ningún hilo. Pensado para Joan Anton (y para quien le sustituya en
          vacaciones o ausencias).
        </p>

        <h2>En qué consiste</h2>
        <p>
          El dashboard lee automáticamente tres canales de Slack del workspace de
          Adrià Solà Pastor y muestra cada hilo como una tarjeta en un tablero
          Kanban.
        </p>
        <table>
          <thead>
            <tr><th>Canal</th><th>Qué se ve</th></tr>
          </thead>
          <tbody>
            <tr><td><code>#división-ventas-incidencias-pagos</code></td><td>Todos los hilos con respuestas</td></tr>
            <tr><td><code>#división-ventas-administración</code></td><td>Todos los hilos con respuestas</td></tr>
            <tr><td><code>#división-ventas-general</code></td><td>Solo hilos donde se menciona a Joan Anton</td></tr>
          </tbody>
        </table>

        <p>De cada hilo se construye una <b>tarjeta</b> con:</p>
        <ul>
          <li>Categoría auto-detectada (<span className="badge badge-acceso">🔴 Acceso</span> / <span className="badge badge-reembolso">💰 Reembolso</span> / <span className="badge badge-otro">📌 Otro</span>).</li>
          <li>Canal del que viene.</li>
          <li>Antigüedad (verde si es reciente, rojo si lleva días).</li>
          <li>Título y resumen del primer mensaje.</li>
          <li>Indicador <b>⏳ Espera respuesta tuya</b> si la última respuesta no es tuya.</li>
        </ul>

        <h2>Las tres columnas</h2>
        <table>
          <thead>
            <tr><th>Columna</th><th>Color</th><th>Significado</th></tr>
          </thead>
          <tbody>
            <tr><td>📥 Por revisar</td><td>Rojo</td><td>Por defecto. Todo lo nuevo aparece aquí.</td></tr>
            <tr><td>🔄 En progreso</td><td>Amarillo</td><td>Lo estás gestionando ahora mismo.</td></tr>
            <tr><td>✅ Hecho</td><td>Verde</td><td>Cerrado. Puedes archivar uno a uno o todos de golpe.</td></tr>
          </tbody>
        </table>
        <div className="callout info">
          El estado está <b>compartido entre todos los usuarios</b> del dashboard
          (Vercel KV). Los cambios que hagas se ven en el otro navegador en máximo
          15 segundos. Si el header muestra <code>💻 local</code> significa que el
          almacén compartido no está disponible y estás en modo solo-navegador.
        </div>

        <h2>Flujo de uso típico</h2>
        <ol>
          <li>Abres el dashboard y ves las tarjetas en <b>Por revisar</b>.</li>
          <li>Las que llevan <code>⏳ Espera respuesta tuya</code> están arriba (son las urgentes).</li>
          <li><b>Clic en una tarjeta</b> → se abre un modal con el hilo entero.</li>
          <li>Desde el modal puedes:
            <ul>
              <li>Leer todos los mensajes con nombres y formato.</li>
              <li>Pulsar <b>💬 Abrir en Slack</b> para ir al hilo en la app.</li>
              <li>Cambiar de estado con los botones del footer sin cerrar el modal (se cierra solo al pulsar).</li>
            </ul>
          </li>
        </ol>

        <h2>Qué pasa en Slack al cambiar de estado</h2>
        <table>
          <thead>
            <tr><th>Transición en el dashboard</th><th>Acción en Slack</th></tr>
          </thead>
          <tbody>
            <tr><td>Por revisar → <b>En progreso</b></td><td>Añade reacción 👀 al mensaje raíz</td></tr>
            <tr><td>En progreso → Por revisar</td><td>Quita la reacción 👀</td></tr>
            <tr><td>→ <b>Hecho</b> (desde cualquiera)</td><td>Añade reacción ✅ y marca canal leído</td></tr>
            <tr><td>Hecho → reabrir</td><td>Quita la reacción ✅</td></tr>
          </tbody>
        </table>
        <div className="callout">
          Las reacciones se publican <b>como Joan Anton</b> (no como bot), porque el
          dashboard usa su user token de Slack. Aunque las pulse Lautaro, en Slack
          aparecerá como si las hubiera puesto Joan. No es un bug, es la única forma
          de que cuenten como suyas y limpien las menciones de su inbox.
        </div>

        <h2>Filtros y herramientas</h2>
        <ul>
          <li><b>Por canal:</b> arriba a la derecha (Todos / incidencias-pagos / administración / general).</li>
          <li><b>Por categoría:</b> justo debajo (Todas / Acceso / Reembolso / Otro con contadores).</li>
          <li><b>Buscador:</b> pega un link de Slack para localizar el hilo exacto, o escribe texto libre para filtrar.</li>
          <li><b>↻ Refrescar:</b> vuelve a leer Slack. No hay auto-refresco todavía.</li>
          <li><b>🗑 Archivar todos:</b> en la columna Hecho, archiva todas las cerradas de golpe.</li>
        </ul>

        <h2>Auto-promoción por reacción</h2>
        <p>
          Si reaccionas con ✅ directamente desde Slack, la próxima vez que cargues
          el dashboard ese hilo aparecerá automáticamente en <b>Hecho</b>. La fuente
          de verdad es Slack — solo cuentan las reacciones puestas por Joan (no las
          de otros).
        </p>

        <h2>Casos de uso</h2>

        <h3><span className="badge badge-reembolso">💰 Reembolso</span></h3>
        <p><i>Aplica a hilos sobre reembolsos, devoluciones, cobros incorrectos o dobles cargos.</i></p>
        <div className="step reembolso">
          <h4>Caso único — cualquier solicitud de reembolso</h4>
          <ol>
            <li>Etiquetar a <b>Sílvia</b> en el hilo (ella lo gestiona end-to-end).</li>
            <li>Mover la tarjeta a <b>En progreso</b> (añade 👀 al hilo automáticamente).</li>
          </ol>
        </div>

        <h3><span className="badge badge-acceso">🔴 Acceso</span> (cuota atrasada / impago)</h3>
        <p><i>Aplica a hilos sobre quitar/pausar/revocar accesos, darse de baja, o menciones a "cuota atrasada" / "impago".</i></p>

        <div className="step acceso">
          <h4>Caso A — Cliente pide que NO le pausemos accesos</h4>
          <ol>
            <li>Marcar el checkbox <b>"No es Impago"</b> en el CRM (Airtable).</li>
            <li>Programar un <b>follow up en X días</b> etiquetando al closer para preguntar en qué estado está.</li>
            <li>Mover tarjeta a <b>En progreso</b>.</li>
          </ol>
        </div>

        <div className="step acceso">
          <h4>Caso B — Cliente dice que ya ha pagado</h4>
          <ol>
            <li>Revisar en <b>Airtable</b> que el pago esté registrado.</li>
            <li><b>Si el pago está registrado:</b>
              <ul>
                <li>Verificar que el cliente ya NO aparece en la lista de cuotas atrasadas.</li>
                <li><b>Si sigue apareciendo</b> → marcar <b>"No es impago"</b> + tarjeta a <b>Hecho</b>.</li>
                <li><b>Si ya no aparece</b> → tarjeta directamente a <b>Hecho</b>.</li>
              </ul>
            </li>
            <li><b>Si el pago NO está registrado:</b>
              <ul>
                <li>Mensajear al closer en el hilo:
                  <blockquote>
                    <code>@closer no veo el pago registrado en airtable, ¿puedes registrarlo por favor?</code>
                  </blockquote>
                </li>
                <li>Mover tarjeta a <b>En progreso</b>.</li>
              </ul>
            </li>
          </ol>
        </div>

        <div className="step acceso">
          <h4>Caso C — Cliente dice que está gestionando el pago</h4>
          <ol>
            <li>Programar un mensaje de <b>follow up a los 3-4 días</b>.</li>
            <li>Mover tarjeta a <b>En progreso</b>.</li>
          </ol>
        </div>

        <h3><span className="badge badge-otro">📌 Otro</span></h3>
        <p><i>Preguntas del equipo sobre el CRM, dudas operativas, configuración, etc.</i></p>
        <p>
          Sin protocolo fijo todavía. Si aparece algún caso recurrente que requiera
          pasos estandarizados, lo añadimos aquí.
        </p>

        <hr />

        <h2>Recordatorio operativo</h2>
        <div className="callout ok">
          🔁 <b>Revisar las tarjetas en "En progreso" cada 2-3 días</b> para
          asegurarse de que no se quedan paradas (follow up al cliente, al closer,
          o cerrar si ya está resuelto).
        </div>

        <h2>Preguntas frecuentes</h2>

        <h4>¿Y si no aparece un hilo que sí está en Slack?</h4>
        <p>
          Comprueba que el bot esté invitado al canal. Si no, escribe
          <code>/invite @Joan Anton Slack Bot</code> dentro del canal y refresca el
          dashboard.
        </p>

        <h4>¿Y si una tarjeta aparece con el ID <code>@U…</code> en vez del nombre?</h4>
        <p>
          Probablemente sea un usuario nuevo del workspace. Refresca el dashboard —
          si persiste, avisa a Joan.
        </p>

        <h4>¿Puedo escribir respuestas desde el dashboard?</h4>
        <p>
          No por ahora. El dashboard solo lee y permite cambiar estado / reaccionar.
          Para responder, pulsa "💬 Abrir en Slack".
        </p>

        <h4>Si marco Hecho por error, ¿se puede deshacer?</h4>
        <p>
          Sí. Abre la tarjeta y pulsa "↩ Reabrir" o muévela desde la columna Hecho
          a otra. Eso también quita la ✅ del hilo en Slack.
        </p>

        <div className="footer-note">
          Repo: <a href="https://github.com/joanantontorello/slack-incident-agent" target="_blank" rel="noopener noreferrer">slack-incident-agent</a>
          {' '}· Reportar problemas o pedir mejoras: DM a Joan por Slack.
        </div>
      </div>
    </>
  );
}
