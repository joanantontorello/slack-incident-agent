# Pipeline Incidencias Ventas — Vercel

Dashboard Kanban (Por revisar / En progreso / Hecho) que lee hilos de Slack en vivo y los presenta como tarjetas con link directo a cada hilo.

## 1) Crear la app de Slack (5 min)

1. Ve a https://api.slack.com/apps → **Create New App** → **From scratch**.
2. Nombre: `ICO Pipeline Bot`. Workspace: el de ICO/Fidelio.
3. En el menú izquierdo → **OAuth & Permissions** → sección **Scopes** → **Bot Token Scopes** → añade:
   - `channels:history`
   - `channels:read`
   - `groups:history` (canales privados)
   - `groups:read`
   - `users:read`
4. Arriba del todo, **Install to Workspace** → autoriza.
5. Copia el **Bot User OAuth Token** (empieza por `xoxb-...`). Lo necesitas para Vercel.
6. En Slack, invita al bot a los 3 canales:
   ```
   /invite @ICO Pipeline Bot
   ```
   En `#división-ventas-incidencias-pagos`, `#división-ventas-administración`, `#división-ventas-general`.

## 2) Subir el código a un repo

```bash
cd pipeline-vercel
git init
git add .
git commit -m "Initial commit"
# Crea repo en GitHub (público o privado) y haz push
git remote add origin git@github.com:TU_USUARIO/pipeline-incidencias.git
git push -u origin main
```

## 3) Desplegar en Vercel (3 min)

1. https://vercel.com/new → importa el repo de GitHub.
2. Framework: **Next.js** (lo detecta solo).
3. Antes de hacer Deploy, abre **Environment Variables** y añade:

   | Variable | Valor |
   |---|---|
   | `SLACK_BOT_TOKEN` | `xoxb-...` (el del paso 1) |
   | `MY_USER_ID` | `U08N1C4B9PC` |
   | `SLACK_CHANNELS` | `C0A0W5N0LUC,C097D0JTL48,C096QADCNMQ:mention` |
   | `BASIC_AUTH_USER` | `joan` (o lo que quieras) |
   | `BASIC_AUTH_PASS` | un password fuerte |

4. **Deploy**. En 1-2 min tendrás una URL `https://pipeline-incidencias-XXX.vercel.app`.
5. Al entrar te pedirá usuario/password (los que pusiste arriba).

## 4) Uso

- Refresca con el botón **↻ Refrescar** o recarga la página.
- Mueve casos entre columnas con los botones de cada tarjeta.
- Click en **💬 Ver hilo** abre Slack directo (web o app si está instalada).
- El estado del pipeline se guarda en `localStorage` del navegador — si usas varios navegadores cada uno tendrá su propio estado.

## Configuración avanzada

### Canales
Formato: `CHANNEL_ID` (todos los hilos) o `CHANNEL_ID:mention` (solo donde te mencionan).

```
SLACK_CHANNELS=C0A0W5N0LUC,C097D0JTL48,C096QADCNMQ:mention
```

Para añadir más canales basta con añadirlos a la lista y re-deploy (Vercel lo hace solo si cambias env vars).

### Cambiar look & feel
Edita `app/page.js` — todo el CSS está inline en el componente.

## Dev local

```bash
npm install
cp .env.example .env.local  # rellena los valores
npm run dev
# http://localhost:3000
```

## Archivos clave

```
pipeline-vercel/
├── app/
│   ├── page.js              # Dashboard (UI principal)
│   ├── layout.js
│   ├── lib/slack.js         # Helper para Slack Web API
│   └── api/
│       ├── messages/        # GET /api/messages?days=14
│       ├── thread/          # GET /api/thread?channel=X&ts=Y
│       ├── users/           # GET /api/users?ids=U1,U2
│       └── config/          # GET /api/config
├── middleware.js            # Basic auth
├── package.json
├── next.config.mjs
└── .env.example
```
