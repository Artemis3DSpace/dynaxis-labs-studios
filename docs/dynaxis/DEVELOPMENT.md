# Dynaxis Labs Studios — Development

Practical commands for local development. See `PHASE_5D_RUNTIME_HARDENING.md` for
the rationale behind the watcher and server/client boundary configuration.

## Prerequisites

- Node.js 20.6+ (repo validated on Node 22).
- `npm install` (first run: `npm run setup` also inits submodules + builds packages).

## Running the app (Next.js)

### Normal development — native file watching (use this)

```bash
npm run dev
```

- Uses the Webpack dev bundler with **native** filesystem watching + HMR.
- Do **not** set `WATCHPACK_POLLING` / `CHOKIDAR_USEPOLLING` for normal local
  development on macOS/Linux/Windows local disks. Native events are lower-latency
  and do not accumulate memory the way timer-based polling does.
- No custom Node heap size is required.

### Polling fallback — only if native watching misses changes

```bash
npm run dev:polling
```

Use **only** when file changes are genuinely not detected by native watching —
e.g. some network filesystems, mounted/virtualised volumes, VMs, remote dev, or
container filesystems. Polling is opt-in and must not be the default: over long
sessions it increases memory pressure.

### Large-heap troubleshooting — rarely needed

```bash
npm run dev:large-heap
```

Runs the dev server with `--max-old-space-size=8192`. This exists only for ad-hoc
troubleshooting of unusually large builds. It is **not** the standard workflow and
should not be used to mask a memory problem — prefer native watching.

## Watcher stability check

```bash
npm run watch:check         # defaults: --port 3013 --cycles 6
```

Starts native `next dev`, forces `/studio` to compile, runs edit cycles (HMR) plus
a create/delete probe, and reports RSS samples and recompile counts. A short
smoke test for obvious unbounded watcher/memory behaviour — not a multi-hour leak
proof.

## Tests

```bash
npm run test:dynaxis        # Dynaxis platform + boundary + Character suites
npm test                    # local-inference *.test.js + test:dynaxis
```

`test:dynaxis` runs with `node --import ./tests/setup/allow-server-only.mjs`, a
surgical hook that resolves the `server-only` marker to a no-op **only** for the
Node test runner (React and everything else resolve normally). Do not replace this
with a global `--conditions=react-server`, which would switch React to its RSC
build and break client APIs used in tests.

## Database

```bash
npm run db:generate         # drizzle-kit generate
DATABASE_URL=postgres://... npm run db:migrate
```

Platform persistence requires PostgreSQL (`DATABASE_URL`). Tests use an explicit
in-memory driver (`DYNAXIS_PLATFORM_DRIVER=memory`).

## Asset Blob Store (Phase 6E.1)

Composition PNG exports and other Dynaxis-managed binaries use the Asset Blob Store:

| Driver | Env | Use |
|--------|-----|-----|
| `memory` | `DYNAXIS_ASSET_STORAGE=memory` | Automated tests only |
| `filesystem` | default in non-production | Local `.dynaxis-blob-store/` |
| `s3` | required in production | S3-compatible bucket (see `.env.example`) |

Production without `DYNAXIS_S3_BUCKET` / credentials returns `ASSET_STORAGE_UNAVAILABLE`.  
Do not set production to `memory` or rely on data-URL Asset persistence.

## Electron (separate legacy renderer)

```bash
npm run vite:build          # build renderer from src/
npm run electron:dev        # vite build + electron .
```

Electron builds from `src/` via Vite and is independent of `lib/dynaxis`.

## Server / client module boundary (important)

- **Client Components** (`'use client'`) import from `@/lib/dynaxis/client` (the
  canonical client-safe entrypoint), scoped client-safe subpaths, or
  `@/lib/dynaxis/mini-apps`. They must never import server modules.
- **Server code** (API routes / RSC / Node scripts) imports from
  `@/lib/dynaxis/server` and the service modules.
- Server-only modules (`ownership.js`, `db/*`, `services/*`, `platform.js`,
  `api.js`, `server.js`) are marked with `import 'server-only'`. Importing any of
  them from a Client Component fails the build by design — do **not** work around
  this with a browser crypto polyfill or by aliasing `node:crypto`. Move the code
  to the server graph and call it via `/api/dynaxis/*`.
- `tests/dynaxis-boundary.test.mjs` enforces these rules.
