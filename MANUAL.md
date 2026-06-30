# Manual de uso — Pipeline de Incidencias de Ventas

Dashboard interno para gestionar las incidencias que entran por Slack
sin perder ningún hilo. Pensado para Joan Anton (y para quien le
sustituya en vacaciones o ausencias).

**URL producción:** https://slack-incident-agent.vercel.app

---

## En qué consiste

El dashboard lee automáticamente tres canales de Slack del workspace
de Adrià Solà Pastor:

| Canal | Qué se ve |
|---|---|
| `#división-ventas-incidencias-pagos` | Todos los hilos con respuestas |
| `#división-ventas-administración` | Todos los hilos con respuestas |
| `#división-ventas-general` | Solo los hilos donde se menciona a Joan Anton |

De cada hilo se construye una **tarjeta** con:

- **Categoría** auto-detectada (🔴 Acceso / 💰 Reembolso / 📌 Otro).
- **Canal** del que viene.
- **Antigüedad** (color verde si es de hoy, naranja si lleva 2-3 días,
  rojo si lleva más).
- **Título** y resumen del primer mensaje.
- Indicador **⏳ Espera respuesta tuya** si la última respuesta no es
  tuya y se te menciona en el hilo.
- Botones de acción (ver más abajo).

---

## Las tres columnas

| Columna | Color | Significado |
|---|---|---|
| 📥 Por revisar | Rojo | Por defecto. Todo lo nuevo aparece aquí. |
| 🔄 En progreso | Amarillo | Lo estás gestionando ahora mismo. |
| ✅ Hecho | Verde | Cerrado. Puedes archivar uno a uno o todos de golpe. |

El estado de cada tarjeta se guarda **en tu navegador** (localStorage).
No se sincroniza entre dispositivos ni entre personas — cada uno tiene
su propio Kanban personal.

---

## Flujo de uso típico

1. Abres el dashboard y ves todas las tarjetas en **Por revisar**.
2. Las que llevan `⏳ Espera respuesta tuya` aparecen arriba del todo
   (son las urgentes).
3. **Clic en una tarjeta** → se abre un modal con el hilo entero.
4. Desde el modal puedes:
   - Leer todos los mensajes con nombres, fechas y formato real.
   - Pulsar **💬 Abrir en Slack** para ir directamente al hilo en la
     app de Slack.
   - Cambiar el estado con los botones del footer (▶ En progreso,
     ✓ Hecho, etc.) sin tener que cerrar el modal y volver a la
     tarjeta. Tras pulsar, el modal se cierra solo para que vayas al
     siguiente.

---

## Qué pasa en Slack al cambiar de estado

| Transición en el dashboard | Acción en Slack |
|---|---|
| Por revisar → **En progreso** | Añade reacción 👀 al mensaje raíz del hilo |
| En progreso → Por revisar | Quita la reacción 👀 |
| → **Hecho** (desde cualquiera) | Añade reacción ✅ y marca el canal como leído |
| Hecho → reabrir | Quita la reacción ✅ |

Las reacciones se publican **como Joan Anton** (no como bot), porque
el dashboard usa su user token de Slack. Esto significa que, aunque
las pulse otra persona desde el dashboard, en Slack aparecerá como
si las hubiera puesto Joan. **No es un bug**, es la única forma de
que las reacciones cuenten como suyas y limpien las menciones de su
inbox.

---

## Filtros y herramientas

- **Por canal**: arriba a la derecha — Todos / incidencias-pagos /
  administración / general.
- **Por categoría**: justo debajo — Todas / 🔴 Acceso / 💰 Reembolso /
  📌 Otro (con contadores).
- **↻ Refrescar**: vuelve a leer Slack. Hazlo cada cierto tiempo —
  no hay auto-refresco todavía.
- **🗑 Archivar todos** (en columna Hecho): archiva en lote todas las
  tarjetas cerradas con un solo clic.

---

## Auto-promoción a "Hecho" por reacción en Slack

Si reaccionas con ✅ directamente desde Slack a un hilo, la próxima
vez que cargues el dashboard, ese hilo aparecerá automáticamente en
**Hecho**. La fuente de verdad es Slack — solo cuentan las reacciones
puestas por Joan Anton (no las de otros).

---

## Casos de uso

### 💰 Reembolso

**Cuándo aplica:** hilos sobre reembolsos, devoluciones, cobros
incorrectos, dobles cargos.

#### Caso único — Cualquier solicitud de reembolso
1. Etiquetar a **Sílvia** en el hilo (ella lo gestiona end-to-end).
2. Mover la tarjeta a **En progreso** en el dashboard
   (automáticamente añade 👀 al hilo).

---

### 🔴 Acceso (cuota atrasada / impago)

**Cuándo aplica:** hilos sobre quitar/pausar/revocar accesos, darse
de baja, o cualquier mención a "cuota atrasada" / "impago".

#### Caso A — Cliente pide que **no le pausemos accesos**
1. Marcar el checkbox **"No es Impago"** en el CRM (Airtable).
2. Programar un **follow up en X días** etiquetando al closer para
   preguntar en qué estado está.
3. Mover la tarjeta a **En progreso**.

#### Caso B — Cliente dice que **ya ha pagado**
1. Revisar en **Airtable** que el pago esté registrado.
2. **Si el pago está registrado en Airtable:**
   - Verificar que el cliente ya NO aparece en la lista de cuotas
     atrasadas.
   - **Si sigue apareciendo** → marcar **"No es impago"** + mover
     tarjeta a **Hecho**.
   - **Si ya no aparece** → mover tarjeta directamente a **Hecho**.
3. **Si el pago NO está registrado en Airtable:**
   - Mensajear al closer en el hilo:
     > `@closer no veo el pago registrado en airtable, ¿puedes
     > registrarlo por favor?`
   - Mover tarjeta a **En progreso**.

#### Caso C — Cliente dice que **está gestionando el pago**
1. Programar un mensaje de **follow up a los 3-4 días**.
2. Mover tarjeta a **En progreso**.

---

### 📌 Otro

**Cuándo aplica:** todo lo demás. Preguntas del equipo sobre el CRM,
dudas operativas, configuración, etc.

> Sin protocolo fijo todavía. Si aparece algún caso recurrente que
> requiera pasos estandarizados, lo añadimos aquí.

---

## Recordatorio operativo

🔁 **Revisar las tarjetas en "En progreso" cada 2-3 días** para
asegurarse de que no se quedan paradas (follow up al cliente, al
closer, o cerrar si ya está resuelto).

---

## Preguntas frecuentes

**¿Y si no aparece un hilo que sí está en Slack?**
Comprueba que el bot "ICO Pipeline Bot" (renombrado a "Joan Anton
Slack Bot") esté invitado al canal. Si no, pega `/invite @Joan Anton
Slack Bot` dentro del canal y refresca el dashboard.

**¿Y si una tarjeta aparece con el ID `@U…` en vez del nombre?**
Probablemente sea un usuario nuevo del workspace. Refresca el
dashboard — si persiste, avisa a Joan para revisar.

**¿Puedo escribir respuestas desde el dashboard?**
No, por ahora. El dashboard solo lee y permite cambiar estado /
reaccionar. Para responder, pulsa "💬 Abrir en Slack".

**Si marco Hecho por error, ¿se puede deshacer?**
Sí. Abre el modal de la tarjeta archivada (está en la sección
"Archivados" al pie de la columna Hecho), pulsa "↩ Reabrir" o pasa la
tarjeta de Hecho a otra columna desde sus botones. Eso también
quita la ✅ del hilo en Slack.

---

## Reportar problemas o pedir mejoras

Si algo no va o ves una mejora que ayudaría: dile a Joan Anton por
DM en Slack. El repo del dashboard está en
https://github.com/joanantontorello/slack-incident-agent
