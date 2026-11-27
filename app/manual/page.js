export const metadata = { title: 'Manual — Pipeline Incidencias' };

const STYLES = `
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
        h2[id] { scroll-margin-top: 64px; }
        .footer-note {
          margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;
          font-size: 12px; color: #94a3b8; text-align: center;
        }
        .footer-note a { color: #64748b; }
`;

export default function ManualPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

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

        <h2 id="mensajes-privados">Mensajes privados</h2>
        <p>
          El panel también puede enseñar los <b>mensajes privados nuevos</b> que
          te llegan en Slack (de una persona o de un grupo privado). Cada
          conversación es una tarjeta más del tablero y se filtra con el botón
          <b> Mensajes privados</b>, junto a los canales. Si el último mensaje es
          de otra persona, sale en <b>Espera mi respuesta</b>; cuando contestas,
          deja de esperar. Si te vuelven a escribir en una conversación que
          tenías en Hecho, vuelve sola a <b>Por revisar</b>.
        </p>
        <p>
          Solo salen los mensajes que lleguen a partir del día en que se activa,
          no los antiguos. Para que funcione hay que dar permiso al panel en
          Slack una sola vez:
        </p>
        <ol>
          <li>Entra en <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">api.slack.com/apps</a> con tu cuenta de Slack.</li>
          <li>Abre la app del panel, que se llama <b>«Joan Anton Slack Bot»</b>.</li>
          <li>En el menú de la izquierda, entra en <b>«OAuth &amp; permissions»</b>. Baja hasta <b>«Scopes»</b> › <b>«User token scopes»</b> y, con el botón <b>«Add an OAuth scope»</b>, añade uno a uno estos cuatro: <code>im:read</code>, <code>im:history</code>, <code>mpim:read</code> y <code>mpim:history</code>.</li>
          <li>Arriba saldrá un aviso que pide reinstalar la app. Pulsa el enlace del aviso (o, en el menú de la izquierda, <b>«Install App»</b> › <b>«Reinstall to…»</b>) y acepta.</li>
          <li>Recarga el panel. Si el aviso amarillo ya no sale, has terminado.</li>
          <li>Si sigue saliendo: vuelve a <b>«OAuth &amp; permissions»</b> y, en <b>«OAuth Tokens»</b>, copia el <b>«User OAuth Token»</b> con su botón <b>«Copy»</b> (empieza por <code>xoxp-</code>). Es como una contraseña: no lo pegues en ningún chat. En Vercel, entra en el proyecto del panel › <b>Settings</b> › <b>Environment Variables</b>, cambia el valor de <code>SLACK_USER_TOKEN</code> por el que has copiado y guarda. Después vuelve a publicar: <b>Deployments</b> › en el primero de la lista, los tres puntos › <b>Redeploy</b>.</li>
        </ol>
        <div className="callout ok">
          Cuando el aviso amarillo desaparece, los privados nuevos empiezan a
          salir desde ese momento. Los antiguos no entran.
        </div>

        <h2 id="agentes">Agentes de IA (botón «Revisar con IA»)</h2>
        <p>
          Al pulsar <b>✨ Revisar con IA</b>, primero se ordenan las tarjetas como siempre. Después,
          los hilos marcados con <b>⚡ Tú</b> y los de <b>Espera mi respuesta</b> (te mencionan y aún no has
          contestado) se mandan a los agentes de Claude, que trabajan en la nube
          (aunque cierres el ordenador).
        </p>
        <ul>
          <li>Leen el hilo entero y deciden qué caso de este manual es.</li>
          <li>Comprueban en Airtable lo que pide el protocolo (pagos, cuotas atrasadas, casillas, enlaces de pago). Solo leen: no cambian nada.</li>
          <li>Dejan la respuesta como <b>borrador dentro del hilo de Slack</b>, sin enviarla. La ves en Slack › Borradores o abriendo el hilo.</li>
          <li>En la tarjeta sale una etiqueta corta («Borrador listo», «Revisado, sin borrador»…). Al abrir la tarjeta ves la nota entera: qué han encontrado y «Falta que tú (Joan): …» si hay algo que solo tú puedes hacer.</li>
        </ul>
        <p>
          Mientras trabajan, la tarjeta dice «🤖 Agente trabajando…». Un hilo ya trabajado no se vuelve a
          mandar en 20 horas salvo que llegue un mensaje nuevo. Máximo 15 hilos por pulsación.
          Los agentes siguen este manual: si cambias un protocolo aquí, lo siguen la próxima vez.
        </p>
        <p>
          <b>Revisión automática:</b> de lunes a viernes a las <b>16:00</b> (hora de España) el panel hace
          solo lo mismo que el botón, aunque no lo tengas abierto. El botón sigue funcionando igual para
          cuando quieras una pasada extra. Pasando el ratón por encima del botón ves cuándo fue la última.
        </p>
        <p>
          Si un hilo ya tiene un borrador del agente que aún no has usado, el agente <b>no crea otro</b>
          (Slack se quedaría con el viejo): solo actualiza la nota de la tarjeta.
        </p>
        <h3 id="sops">SOPs por documentar</h3>
        <p>
          En cada hilo el agente apunta qué ficha de este manual ha usado, o por qué no había ninguna o el
          caso depende de ti. El botón <b>SOPs</b> (arriba, con el icono del libro) abre una ventana con los
          casos del último mes que se repiten y te esperan a ti, ordenados por veces y con uno o dos ejemplos.
          El número del botón dice cuántos hay.
        </p>
        <p>
          Elige el primero y manda un audio contando cómo lo haces. Claude lo convierte en una ficha
          de este manual y, desde que das el OK, los agentes la usan.
        </p>

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

        <div className="step acceso">
          <h4>Caso D — Hay que devolverle accesos a alguien que ya ha pagado</h4>
          <ol>
            <li>Comprobar que efectivamente ha pagado:
              <br />→ <code>Airtable</code> · <code>Contabilidad</code> · mirar el registro de pagos.
            </li>
            <li><b>Si SÍ ha pagado</b>, devolverle accesos:
              <br />→ <code>Airtable</code> · <code>Leads</code> · vista <b>"Cuotas atrasadas"</b>.
              <ul>
                <li>Si está activado <b>"Pausa por impago manual"</b> → desactivarlo.</li>
                <li>Si está activado <b>"Es impago manual"</b> → desactivarlo.</li>
                <li>Si está activado <b>"Alumno Pausado"</b> → desactivarlo, esperar 1-2 min, y verificar en <b>Circle</b> que vuelve a tener accesos.</li>
                <li>Si <b>ninguno</b> de los tres flags (Es impago manual / Pausa por impago manual / Alumno Pausado) está activo → verificar directamente en <b>Circle</b> si tiene accesos:
                  <ul>
                    <li><b>Sí tiene accesos</b> → verificar que en el pipeline de <b>"Alumnos ICO"</b> está como <b>"Activo y en progreso"</b>. Si no, ponerlo así.</li>
                    <li><b>No tiene accesos</b> → darle accesos manuales, esperar 1-2 min, verificar en Circle que vuelve a tener accesos.</li>
                  </ul>
                </li>
                <li><b>Si tras 2 min en Circle no se ha actualizado</b>, hacer manualmente:
                  <ul>
                    <li>Quitar etiqueta <code>Estado_Pausado</code>.</li>
                    <li>Poner etiqueta <code>Estado_Activo</code>.</li>
                  </ul>
                </li>
              </ul>
            </li>
            <li>Mover la tarjeta a <b>Hecho</b> (o marcar ✅ directamente en el hilo de Slack).</li>
          </ol>
        </div>

        <h3><span className="badge badge-otro">📌 Otro</span></h3>
        <p><i>Preguntas del equipo sobre el CRM, dudas operativas, configuración, etc.</i></p>
        <p>
          Sin protocolo fijo todavía. Si aparece algún caso recurrente que requiera
          pasos estandarizados, lo añadimos aquí.
        </p>

        <h3 id="auto-follow-ups"><span className="badge badge-otro">🔁 Auto follow-ups</span> (avisos de #auto-follow-ups)</h3>
        <p>
          <i>Canal de recordatorios automáticos para Joan (C0ABKTFKUB1). Cada aviso es una tarjeta, tenga
          respuestas o no, y va directo a los agentes (la IA no lo da por resuelto). Se lee el último mes,
          para que entren los avisos mensuales. Cuando un aviso está hecho, márcalo con ✅ o pásalo a Hecho.</i>
        </p>

        <div className="step otro">
          <h4>Auto follow-up · Caso pendiente de decisión (recobro)</h4>
          <p><i>Aviso «⏳ Caso pendiente de decisión»: un alumno lleva 10 días en impago y el closer no lo ha recuperado.</i></p>
          <ol>
            <li>Copiar el email del aviso y buscarlo en Slack para encontrar el hilo donde se avisó al closer del impago (normalmente en las divisiones de ventas o de recobros). Mirar también la ficha del alumno en Airtable (👤 Leads, enlace del aviso).</li>
            <li>Leer qué ha contestado el closer en ese hilo:
              <ul>
                <li><b>Dice que lo pausemos y lo pasemos a recobro</b> → pausarlo y en la ficha poner <b>Estado = Pasado a Recobro</b>. (Lo hace Joan.)</li>
                <li><b>No ha contestado</b> → mandarle un follow-up en ese mismo hilo, mencionándole: que el alumno sigue en impago y si lo pasamos a recobro o lo está gestionando él.</li>
                <li><b>Dice que lo está gestionando él</b> → en la ficha, <b>💼 Responsable Recobro = el closer</b>. (Lo hace Joan.) No se pausa.</li>
                <li><b>Dice que ha acordado otra fecha de pago y que está todo en orden</b> → no pausarlo. Nada más.</li>
              </ul>
            </li>
            <li>Si la ficha ya está en «Pasado a Recobro» o con responsable puesto, el aviso ya está resuelto: tarjeta a Hecho.</li>
          </ol>
        </div>

        <div className="step otro">
          <h4>Auto follow-up · Copia de seguridad mensual de GetResponse</h4>
          <p><i>Aviso «Còpia de Seguridad Mensual Get Response» (primer lunes de mes).</i></p>
          <ol>
            <li>La copia la hace Claude en el ordenador de Joan, por la API de GetResponse (solo lee): el CSV <code>Backup_Newsletter_AAAAMMDD</code> con todos los contactos queda en Descargas. Basta con decirle «haz la copia de GetResponse».</li>
            <li>Joan arrastra ese archivo a la carpeta de copias de Drive (la del enlace del aviso).</li>
            <li>Los agentes de la nube no pueden hacerla: no dejan borrador, solo la nota «Falta que tú (Joan): pedirle a Claude la copia de GetResponse y arrastrar el CSV a Drive».</li>
          </ol>
        </div>

        <div className="step otro">
          <h4>Auto follow-up · Informe mensual del Evergreen</h4>
          <p><i>Aviso «Informe Mensual del evergreen» (primer lunes de mes).</i></p>
          <ol>
            <li>Sacar de Airtable (base CRM ICO) los datos del Evergreen del <b>mes anterior</b>. Un lead es del Evergreen si su campaña UTM es <code>ico_evergreen</code> (los lead magnets de evergreen, <code>lm-…</code>, aparte; <code>ico_launch_05</code> es del lanzamiento y no cuenta). Datos: registros, leads, llamadas agendadas y hechas, ventas (número e importe) y, si se puede, la comparación con el mes de antes.</li>
            <li>Escribir un informe corto con esos KPIs principales: una línea por dato y dos o tres frases de lectura. Nada de inventar: si un dato no está, se dice.</li>
            <li>Dejarlo como borrador en el hilo del aviso para que Joan lo revise.</li>
          </ol>
        </div>

        <div className="step otro">
          <h4>Auto follow-up · Renovar servicios de Netelip</h4>
          <p><i>Aviso «Renueva servicios de Netelip» (día 1 de cada mes).</i></p>
          <ol>
            <li>Dejar un borrador en <b>#división-finanzas</b> para Sílvia pidiéndole que recargue saldo en Netelip: <b>300 €</b> por defecto (no se puede entrar a mirar el saldo).</li>
            <li>Antes, mirar en #división-finanzas que Joan no se lo haya pedido ya este mes. Si ya está pedido, tarjeta a Hecho.</li>
            <li>Siempre borrador: lo envía Joan.</li>
          </ol>
        </div>

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
