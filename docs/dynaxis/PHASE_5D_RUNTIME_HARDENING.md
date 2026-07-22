# Phase 5D — Runtime Stability & Server/Client Boundary Hardening

**Status:** Complete (2026-07-21)
**Type:** Infrastructure only — no new product features, no UI/UX change.

This phase resolves the two infrastructure issues exposed during Phase 5C
validation: (1) dev-server file-watcher memory growth, and (2) a server-only
`node:crypto` module reaching the client dependency graph. It also formalises and
**enforces** the server/client module boundary so the class of bug cannot regress.

---

## 1. Original watcher configuration & its source

The long-running dev server that OOM'd was launched with:

```
WATCHPACK_POLLING=true
CHOKIDAR_USEPOLLING=true
NODE_OPTIONS=--max-old-space-size=8192
```

**Source of these variables — documented:** they were injected **only by the
ad-hoc shell command** used to (re)start the dev server, **not** by any project
configuration. Verified:

- `package.json` → `"dev": "next dev"` (clean; no polling, no heap flag, no `--turbopack`).
- No `.env` / `.env.local` at the app root (only `.env.example`).
- `next.config.mjs` is minimal (`transpilePackages` only) — no `webpackDevMiddleware`/`watchOptions` polling.
- No `.cursor` task config in the repo.
- The only `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING`/`max-old-space-size` strings in the tree are in two unrelated sub-package clients (`packages/Vibe-Workflow/client`, `packages/Open-AI-Design-Agent/client`) using Windows `set` syntax — not used by the main app's dev flow.

**Why polling had been used:** an ad-hoc mitigation attempt. On a normal local
macOS filesystem it is unnecessary. Forced polling makes Watchpack/Chokidar
re-`stat` the tree on a timer; over a multi-hour session this drove memory growth
that eventually hit Node's default heap ceiling.

---

## 2. Actual dev bundler

`next dev` (Next.js 15.5.15) with **no `--turbopack` flag → Webpack**. Webpack's
watcher is **Watchpack**, which honours `WATCHPACK_POLLING`. This confirms the
watcher/runtime config being corrected is the Webpack/Watchpack path (not Turbopack).

---

## 3. Custom watcher audit

Searched the repo (excluding `node_modules`) for `chokidar.watch`, `fs.watch`,
`fs.watchFile`, `watchpack`, custom watch loops, recursive watchers.
**Result: none exist.** There is no redundant custom watcher duplicating Next.js,
and no watcher with an over-broad scope (`node_modules`, `.next`, `.git`, media,
etc.) to correct. Electron uses Vite on a separate `src/` tree and has no
filesystem watcher of its own. No speculative Webpack `watchOptions` were added.

---

## 4. Final native-watch configuration

`package.json` scripts:

| Script | Purpose |
|--------|---------|
| `dev` | `next dev` — **native** filesystem watching + HMR. Default for local dev. |
| `dev:polling` | `WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=true next dev` — explicit fallback for network FS / VMs / containers only. |
| `dev:large-heap` | `NODE_OPTIONS=--max-old-space-size=8192 next dev` — optional troubleshooting only. |

- Native watching is the default. Polling is **opt-in**, never automatic.
- HMR is not disabled; watching is not globally disabled.

### Node heap: before → after

- **Before:** `--max-old-space-size=8192` (8 GB) passed inline as a default workaround.
- **After:** default `dev` uses Node's normal heap (no override). The 8 GB heap
  is available only via the explicitly named `dev:large-heap` troubleshooting
  script. Developers no longer allocate 8 GB by default.

---

## 5. Watcher validation (reproducible, short-cycle)

Tooling: `scripts/dynaxis-watch-check.mjs` (`npm run watch:check`). It starts
native `next dev` (explicitly clearing `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING`/
`NODE_OPTIONS`), forces `/studio` to compile, then runs N edit cycles (toggling a
harmless comment inside `app/globals.css`), plus a create+delete probe, sampling
the dev-server RSS each cycle.

**Observed (6 cycles, native watching):**

- Startup: `✓ Ready in ~1.7s`.
- HMR recompiles detected: **6/6** cycles (`✓ Compiled …` each time) → native
  change detection works without polling.
- Create + delete probe ran (add/unlink detection).
- RSS across cycles: `78.8 → 50.8 → 31.7 → 30.9 → 30.9 → 30.9 → 30.9 MB` — memory
  **settled and stayed flat**; no per-cycle growth and no duplicate rebuild loops
  (one clean compile per edit).
- `next dev` process count stable (2: parent + worker).

**Honest scope:** this is a short-cycle smoke test that detects obvious unbounded
behaviour. It was **not** run for 3–4 hours, so it does not *prove* the multi-hour
leak is mathematically eliminated. What it does establish: forced polling is
removed, native HMR works, and short-cycle memory is stable/flat.

---

## 6. Original `node:crypto` dependency path

Reported (transient) trace:

```
node:crypto → lib/dynaxis/ownership.js → lib/dynaxis/platform.js
            → lib/dynaxis/index.js → components/StandaloneShell.js
```

`ownership.js` uses `createHash` from `node:crypto` for `owner_ref` derivation.
The trace was produced by a **prior** `index.js` that re-exported `platform.js`
(which imports `ownership.js`). By the time of this phase, `index.js` had already
been refactored to a client-safe surface that no longer imports `platform.js`, so
the current graph was clean **by convention** — but the boundary was **not
enforced**, so any future edit could reintroduce the taint (exactly what had
happened). Phase 5D makes the boundary enforced.

---

## 7. Module classification (`lib/dynaxis/*`)

### SERVER-ONLY (must never enter the client graph)

- `ownership.js` — `node:crypto`, `owner_ref` hashing/identity
- `db/client.js` — Drizzle + `postgres` + `DATABASE_URL`
- `db/store.js` — store resolver (Drizzle/schema/memory)
- `db/schema.js`, `db/character-postgres.js`, `db/memory-store.js`, `db/character-memory.js`
- `services/*.js` — projects, assets, generations, jobs, lifecycle, characters, character-chat, history-compat (all reach `db/store.js`)
- `platform.js` — service façade (imports ownership + services + db)
- `api.js` — API-route helpers (imports ownership + db/client + `next/server`)
- `server.js` — server barrel

### CLIENT-SAFE

- `client.js` (canonical client entrypoint), `index.js` (alias)
- `session.js`, `client/platform-api.js`, `client/project-context.js`, `client/local-history.js`
- `mini-apps/*` (SDK contracts, no DB/secrets)

### SHARED / PURE (environment-neutral)

- `types.js`, `product.js`, `features.js`, `navigation.js`, `platform-status.js`
- `characters/consumer.js`, `characters/video-capabilities.js`, `characters/index.js`
- `providers/muapi.js`, `providers/llm.js` — pure `fetch` wrappers; the API key is
  passed by the caller and never sourced from a secret env var (only a host URL).
  Kept shared (server-invoked by convention) and **not** marked `server-only` to
  avoid breaking their existing direct test imports; they carry no secrets.

Pure schemas/constants/transformations are intentionally **not** duplicated across
a server/client split (avoids divergence).

---

## 8. Server-only boundaries (enforcement)

Installed the React `server-only` marker package and added `import 'server-only';`
to the true server chokepoints:

- `ownership.js`, `db/client.js`, `db/store.js`, `platform.js`, `api.js`, `server.js`

Effect: if a Client Component ever imports one of these (directly or transitively),
Next's client bundler resolves `server-only`'s `default` export, which **throws at
build time** — the accidental import fails immediately instead of shipping
`node:crypto` to the browser. API routes / RSC use the `react-server` condition,
where `server-only` resolves to a no-op, so server code is unaffected.

**Node test runner:** plain `node --test` has no `react-server` condition, so it
would otherwise hit the throwing `default`. Rather than pass a global
`--conditions=react-server` (which also switches **React** to its RSC build and
breaks client APIs like `React.Component`), we use a **surgical resolve hook**
(`tests/setup/allow-server-only.mjs` + `server-only-loader.mjs` +
`server-only-empty.mjs`) that remaps only the `server-only` specifier to a no-op.
`test:dynaxis` runs with `node --import ./tests/setup/allow-server-only.mjs`.

---

## 9. Client entrypoint architecture

- `lib/dynaxis/client.js` — **canonical client-safe entrypoint** (symmetric with `server.js`).
- `lib/dynaxis/index.js` — thin `export * from './client.js'` alias (backward compatible; stays client-safe).
- `lib/dynaxis/server.js` — server-only barrel (guarded).
- `lib/dynaxis/mini-apps/index.js` — scoped client-safe SDK entry (unchanged, verified clean).

Client Components import `@/lib/dynaxis/client` (or scoped client-safe subpaths).
Server (API routes / RSC / services) import `@/lib/dynaxis/server` and service modules.

---

## 10. `StandaloneShell.js` fix

`components/StandaloneShell.js` (`'use client'`) previously imported the top-level
barrel `@/lib/dynaxis`. Repointed to the explicit client entrypoint
`@/lib/dynaxis/client`. Its named imports were already all client-safe
(`DYNAXIS_PRODUCT`, nav/feature helpers, `getApiKey`/`setApiKey`/`clearApiKey`,
`createPlatformClient`, project-context helpers, `collectLocalHistoryEntries`).
`@/lib/dynaxis/mini-apps` import retained (client-safe).

---

## 11. Character client import audit (Phase 5C preserved)

- `CharacterPicker.jsx`, `CharacterReferencePicker.jsx`, `AiInfluencerStudio.jsx`,
  `VideoStudio.jsx` import only client-safe paths (`client/platform-api.js`,
  `client/project-context.js`, `characters/consumer.js`,
  `characters/video-capabilities.js`).
- **Bug fixed:** `CharacterPicker.jsx` lives one directory deeper
  (`components/character/`) and used `../../../../lib/...` (4 levels) instead of
  `../../../../../lib/...` (5 levels). This resolved to a non-existent
  `packages/lib/dynaxis` and broke the `/studio` build. Fixed to 5 levels. A new
  boundary test now verifies these studio→`lib/dynaxis` imports resolve.
- Character reuse remains fully intact: picker, deterministic reference selection,
  revision provenance, generation context bridge, video capability checks, and
  generated-Asset promotion are unchanged.

---

## 12. Ownership / provider / database boundary

- Ownership hashing (`owner_ref` via `node:crypto`) remains **server-side only**
  (`ownership.js`, now `server-only`). The browser never reproduces owner hashing;
  it sends `x-api-key` and the server derives/validates `owner_ref`.
- All `/api/dynaxis/*` routes import server functionality via `@/lib/dynaxis/api`
  (→ ownership/services/db). They do not import the client barrel.
- Provider execution (MuAPI/LLM) and DB persistence stay server-invoked; no
  provider credentials were moved into client-safe modules.

---

## 13. Electron implications

Electron builds a **separate** legacy renderer from `src/` via Vite and does
**not** import `lib/dynaxis`. Adding `server-only` therefore has zero effect on
Electron packaging. Verified: `vite build` succeeds (27 modules, no crypto/
server-only errors). No Electron redesign or unification was performed.

---

## 14. Tests

- `tests/dynaxis-boundary.test.mjs` (11 tests):
  - client `client.js`/`index.js`/`mini-apps` graphs never reach
    `server-only`/`node:crypto`/`drizzle-orm`/`postgres` (real dependency-graph walk);
  - client graph never includes server-only files (ownership/db/platform/api/server);
  - studio Character/Influencer/Video `lib/dynaxis` imports resolve to real files;
  - server-only guards are present on the six server modules;
  - importing `server-only` and `ownership.js` **throws** in a fresh Node process
    without the shim (real runtime enforcement check);
  - `dev` script forces no polling/heap; `dev:polling`/`dev:large-heap` fallbacks behave.
- `test:dynaxis` runs with the surgical `server-only` resolve hook.

---

## 15. Validation results

| Check | Result |
|-------|--------|
| `test:dynaxis` (incl. boundary) | **84/84 pass** |
| `next build` (production) | **Compiled successfully** (~20s); `/studio` + all API routes; no crypto/server-only errors |
| `vite build` (Electron renderer) | **Success** (exit 0) |
| `npm run watch:check` | **PASS** — native HMR 6/6, RSS flat ~31 MB |
| Editor diagnostics on edited files | **Clean** |
| `next lint` | Not configured in repo (deprecated interactive prompt) — pre-existing; out of scope |

---

## 16. Required architecture (after Phase 5D)

```
CLIENT GRAPH
  React Client Component
    → @/lib/dynaxis/client  (or scoped client-safe subpaths / mini-apps SDK)
    → /api/dynaxis/*        (HTTP)
  NO node:crypto · NO Drizzle · NO DB · NO secrets   (enforced by server-only + tests)

SERVER GRAPH
  /api/dynaxis/* route
    → @/lib/dynaxis/api → ownership → services → db (Drizzle/PostgreSQL)
    → provider adapters (MuAPI/LLM)
  May use node:crypto · PostgreSQL · Drizzle · secret env

SHARED (pure only)
  schemas · data contracts · constants · transformations
```

---

## 17. Remaining risks

- **Watcher:** short-cycle memory is flat; a multi-hour native-watch run was not
  performed, so long-run behaviour is expected-good but not exhaustively proven.
  Native watching removes the polling-driven growth mechanism.
- **Boundary:** `server-only` + build + tests enforce the client/server split.
  Residual risk is limited to modules deliberately kept *shared* (`providers/*`):
  they carry no secrets today, but if a secret is ever added there it must be moved
  behind `server-only`.
