# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Dynaxis Labs Studios (upstream "Open Generative AI"): an npm-workspaces monorepo shipping
two frontends from one codebase — a **Next.js 15 web app** (`app/`, the primary dev target)
and an **Electron desktop app** (Vite build in `electron/`). Actual model inference is done
by the external **MuAPI.ai** SaaS (users bring their own API key). The web app persists
Projects/Assets/Generations to **PostgreSQL** via Drizzle. Workspace packages live under
`packages/` and three of them are **git submodules** (`Vibe-Workflow`, `Open-Poe-AI`,
`Open-AI-Design-Agent`) that must be initialized or builds fail.

### Services

| Service | Required | How to run | Notes |
|---|---|---|---|
| Next.js web app | Yes (primary) | `npm run dev` → http://localhost:3000 | `/` redirects to `/studio`. First request compiles for ~20s. |
| PostgreSQL 16 | Yes for web persistence | see "Postgres" below | Installed via apt; not auto-started on boot. |
| Electron desktop app | Optional | `npm run electron:dev` | Needs a GUI display; not suitable for headless testing. |
| MuAPI.ai | Only for real generation | user supplies key in-app | Not needed to boot/test the UI or persistence layer. |

### Postgres (not auto-started)
PostgreSQL is installed but does NOT start automatically in a fresh VM. Start it with:
`sudo pg_ctlcluster 16 main start`
The dev DB/role are `dynaxis`/`dynaxis` (password `dynaxis`), database `dynaxis`. Connection
config lives in `.env` (gitignored, persisted in the VM snapshot — not in git). If `.env` is
ever missing, recreate it from `.env.example` with a `DATABASE_URL`, a random
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, and
`DYNAXIS_ASSET_STORAGE=filesystem`.

### Migrations
Schema changes are applied with `npm run db:migrate` (idempotent; tracks applied files in
`dynaxis_schema_migrations`). Already applied in this environment. `npm run db:generate`
regenerates SQL from the Drizzle schema.

### Auth / identity gotcha
Platform API routes under `/api/dynaxis/*` authenticate via the `x-api-key` header, which is
**hashed into an owner id — it is NOT validated against MuAPI**. Any non-empty value works as a
distinct identity, so you can exercise the full persistence stack without a real MuAPI key
(e.g. `curl -H 'x-api-key: anything' localhost:3000/api/dynaxis/projects`). Real media
generation (the `/api/v1/*` proxy to MuAPI) does require a valid MuAPI key.

### Tests
`npm test` runs `node --test tests/*.test.js` then `npm run test:dynaxis` (memory drivers,
no DB/network). Expect **4 pre-existing failures unrelated to setup**: three
`dynaxis-project-membership-service` PostgreSQL tests hardcode the macOS path
`/opt/homebrew/bin/initdb` (won't run on Linux), and `dynaxis-auth-context-route-context`
fails on a Node ESM resolution quirk importing `next/server`. The other 383 pass.

### Lint
`npm run lint` (`next lint`) has **no committed ESLint config**, so it prompts interactively to
create one — it does not run non-interactively as-is.
