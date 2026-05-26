# Pipeline Incidencias Ventas — Contexto para Claude Code

Lee este archivo entero antes de empezar a hacer cambios.

## Qué es esto

Dashboard Kanban (Por revisar / En progreso / Hecho) que lee 3 canales de Slack del workspace de Adrià Solà Pastor (ICO/Fidelio) y muestra cada hilo abierto como una tarjeta con link directo al hilo. Pensado para que Joan Anton Torelló (COO) gestione las incidencias de ventas/pagos sin perderse hilos.

Producción: https://slack-incident-agent.vercel.app
Repo: https://github.com/joanantontorello/slack-incident-agent

## Stack

- **Next.js 14** (App Router, JavaScript — no TypeScript)
- **React 18** (componente cliente con `'use client'`)
- **Vercel** (deploy automático desde rama `main`)
- **Slack Web API** (token bot, scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `users:read`)
- **localStorage** para persistir el estado del Kanban (qué casos están en cada columna)
- **Basic auth** vía middleware (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`)

## Estructura

```
.
├── app/
│   ├── layout.js              # Layout root
│   ├── page.js                # Dashboard completo (UI + lógica de fetch)
│   ├── error.js               # Error boundary global
│   ├── lib/slack.js           # Helper slackFetch() y getters de env vars
│   └── api/
│       ├── config/route.js    # GET → { myUserId, channels, team } (cachea auth.test)
│       ├── messages/route.js  # GET ?days=N → { channels: [{channel, filter, messages: []}] }
│       ├── thread/route.js    # GET ?channel=X&ts=Y → { messages: [] }
│       └── users/route.js     # GET ?ids=U1,U2 → { users: { U1: "Nombre", ... } }
├── middleware.js              # Basic auth en todas las rutas
├── package.json, next.config.mjs, .gitignore, .env.example
└── README.md                  # Instrucciones de deploy desde cero
```

## Variables de entorno (ya configuradas en Vercel)

| Var | Para qué |
|---|---|
| `SLACK_BOT_TOKEN` | Token `xoxb-...` del bot "ICO Pipeline Bot" |
| `MY_USER_ID` | `U08N1C4B9PC` (Joan Anton) — usado para detectar "espera respuesta tuya" |
| `SLACK_CHANNELS` | `C0A0W5N0LUC,C097D0JTL48,C096QADCNMQ:mention` — formato `ID` o `ID:mention` (solo donde mencionan a `MY_USER_ID`) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | Login del dashboard |

Canales actuales:
- `C0A0W5N0LUC` → `#división-ventas-incidencias-pagos` (todos los hilos)
- `C097D0JTL48` → `#división-ventas-administración` (todos los hilos)
- `C096QADCNMQ` → `#división-ventas-general` (solo menciones a Joan Anton)

## Flujo de carga (page.js → loadAll)

1. `GET /api/config` → ids de canales, mi user id, team URL (para construir links).
2. `GET /api/messages?days=14` → últimos mensajes de cada canal (en paralelo).
3. Para cada mensaje con `reply_count > 0` (o en canal `:mention`, también mensajes sueltos que me mencionen): `GET /api/thread?channel=X&ts=Y` con **concurrencia 6**.
4. `GET /api/users?ids=U1,U2,...` resuelve user IDs a nombres.
5. El frontend construye los "casos", clasifica por categoría (acceso/reembolso/otro), y determina `waitingForMe` heurísticamente (última respuesta no es mía Y se me menciona en el hilo).
6. Render en 3 columnas. Estado por caso guardado en `localStorage` bajo `pipeline_incidencias_v1`.

## Decisiones de diseño importantes

- **Las API routes nunca devuelven 500.** Si Slack rechaza un canal/hilo (bot no invitado, hilo borrado, rate limit…) devuelven `{ messages: [], slackError: "..." }` con status 200. Así un hilo problemático no rompe la página entera.
- **El loop que construye casos en `page.js` está en `try/catch` por hilo** — un hilo con formato raro (bot Airtable, message_changed…) se ignora en silencio.
- **Links a hilos**: usamos `${team.url}/archives/{channel}/p{ts_no_dot}` (formato directo del workspace). El team URL se obtiene una sola vez via `auth.test` y se cachea en memoria del Vercel function.
- **`shortenText`** limpia `<mailto:...>`, `<tel:...>`, `<@U...>`, `<!channel>` antes de mostrar.
- **Sort**: dentro de cada columna, primero los `waitingForMe`, luego por antigüedad (los más viejos primero — "esto lleva ahí 10 días").

## Estado actual

✅ Funciona en producción. Filtros por canal, mover tarjetas entre columnas, links abren el hilo correcto en Slack. Estado persiste en localStorage del navegador.

## Limitaciones conocidas / bugs menores

- El estado de las tarjetas (qué columna) es por navegador (localStorage). Si abres en móvil y desktop, cada uno tiene su estado. Para sincronizar haría falta un backend (Vercel KV, Upstash Redis, Supabase, etc.).
- La heurística `waitingForMe` es básica (texto incluye `MY_USER_ID`). Puede dar falsos positivos si me mencionan al principio del hilo pero ya he respondido más tarde sin que la última respuesta sea mía.
- No hay refresco automático. Tienes que pulsar "↻ Refrescar" o recargar la página.
- Cargar todo tarda 5-15s porque hace ~160 llamadas a `/api/thread` (concurrencia 6). Se podría optimizar con un endpoint único que haga todo en backend.
- El bot tiene scope `channels:history` + `groups:history`. Si añades un canal nuevo, hay que invitarlo: `/invite @ICO Pipeline Bot` dentro del canal.

## Mejoras posibles (orden de utilidad sugerido)

1. **Sincronizar estado entre dispositivos** → Vercel KV o Upstash Redis. Reemplaza el localStorage por fetch a `/api/state`.
2. **Refresco automático** cada N minutos (setInterval en loadAll).
3. **Notificación push** (Telegram bot ya configurado en otras skills de Cowork) cuando aparece un nuevo hilo "waitingForMe".
4. **Búsqueda / filtrado por texto** dentro del board.
5. **Tagging manual** (etiquetas custom además de la auto-categoría).
6. **Drag & drop** entre columnas (ahora son botones).
7. **Vista móvil mejorada** (ya hay un media query a 800px pero podría pulirse).
8. **Resaltar hilos nuevos** desde la última visita (comparar ts contra `lastSeenTs` en localStorage).
9. **Endpoint único agregado** `/api/dashboard` que devuelve los casos ya procesados desde el backend (menos round-trips, mejor con muchos canales).
10. **Otros canales**: añadir a `SLACK_CHANNELS` en Vercel y re-deploy.

## Cómo iterar

```bash
# Instalación local
npm install
cp .env.example .env.local   # copia los valores de Vercel
npm run dev                  # http://localhost:3000

# Deploy (cualquier push a main lo dispara)
git add .
git commit -m "feat: ..."
git push
```

## Datos del workspace Slack (para que no haya que buscarlos)

- Workspace: Adrià Solà Pastor (ICO/Fidelio)
- Bot name: "ICO Pipeline Bot" (creado por Joan Anton)
- Mi user ID: `U08N1C4B9PC`
- Otros user IDs habituales (por si necesitas filtros): Alex `U0AM3M7G8DN`, Alba `U0AFN2JPC9Y`, Marco `U09KZ7Q43F1`, Silvia `U07D4H2BEH4`, Silvestre `U09MTUF0DC4`, Lautaro `U0B102S2N6Q`, Irene `U09MTUC07EY`, Adrià `U06RB6CQP40`.
