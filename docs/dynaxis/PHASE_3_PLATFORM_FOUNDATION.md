# Dynaxis Labs Studios — Phase 3 Platform Foundation

**Status:** Complete  
**Date:** 2026-07-21  
**Scope:** Persistent Projects, Assets, Generation History, Jobs + MuAPI lifecycle façade  
**UI/UX:** Approved Dynaxis Labs Studios baseline **preserved** (minimal project selector / settings only)  
**Not in scope:** Mini-app framework, Skills, Supercomputer, Dynaxis OS, IdP, billing, object-storage workers

---

## Database decision

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Store | **PostgreSQL** | Production relational metadata store; single coherent DB |
| ORM | **Drizzle ORM** | No prior ORM in host; Drizzle is lightweight and migration-friendly |
| Not used | SQLite / localStorage as SoT | Forbidden as authoritative platform DB |
| Not used | Prisma | Avoid dual-ORM; none was established |

**Env:** `DATABASE_URL` (see `.env.example`)  
**Migrate:** `npm run db:migrate` → applies versioned SQL in `drizzle/`  
**Fail-closed:** Platform APIs return **503** with a clear message when `DATABASE_URL` is missing. Generation via MuAPI still works; lifecycle persistence is skipped (best-effort) so creative flows are not hard-blocked in local setups without Postgres.

**Test-only memory store:** `DYNAXIS_PLATFORM_DRIVER=memory` + `NODE_ENV=test` (or `DYNAXIS_ALLOW_MEMORY_STORE=1`). Never a production fallback.

---

## Architecture flow

```text
Studio UI
  → Dynaxis Project Context (window.__dynaxisProjectId / featureId)
  → packages/studio muapi.js submitAndPoll (wrapped)
      ├─ POST /api/dynaxis/lifecycle/start
      ├─ MuAPI submit + poll (unchanged provider behaviour)
      ├─ POST /api/dynaxis/lifecycle/provider-id
      └─ POST /api/dynaxis/lifecycle/complete | fail
  → Dynaxis Generation Service
  → Dynaxis Job Service
  → MuAPI Provider Adapter (server: lib/dynaxis/providers/muapi.js)
  → MuAPI (api.muapi.ai)
  → Job result
  → Dynaxis Asset Service (metadata; CDN URLs retained)
  → Generation History (dynaxis_generations)
  → Project
```

```text
Studio/UI → Dynaxis Project/Asset/Generation/Job API → services → PostgreSQL
```

Studios do **not** query SQL directly.

---

## Schemas (tables)

| Table | Purpose |
|-------|---------|
| `dynaxis_projects` | Project container; `owner_ref`, `is_default`, status |
| `dynaxis_generations` | Durable history / provenance; optional `migration_key` |
| `dynaxis_jobs` | Lifecycle; `provider_job_id` (MuAPI prediction id) |
| `dynaxis_assets` | Media metadata + URL; type image/video/audio/other |
| `dynaxis_generation_assets` | Many-to-many (multi-output generations) |
| `dynaxis_schema_migrations` | Applied migration filenames |

Ownership column: `owner_ref` = `ak_sha256:<hex>` (hashed API key). Ready for future Dynaxis user IDs without destructive redesign.

---

## Projects

- Real service: create / get / list / update / archive
- **Default Project** auto-created per owner (`ensureDefaultProject`)
- Generations without an explicit project attach to Default Project
- No forced onboarding modal

---

## Assets

- Unified metadata catalogue
- Phase 3 stores MuAPI/CDN URLs (no S3 replication workers)
- Multi-asset generations supported via link table
- Future object storage can replace `url` locality without rewriting studios

---

## Generation History

- Authoritative store: `dynaxis_generations` (+ assets)
- `hg_*` localStorage **retained**; import via `/api/dynaxis/history/import`
- Dedup via deterministic `migration_key` (`hg_import:…`)
- Settings → “Import local studio history”

---

## Jobs / lifecycle

Statuses: `queued` | `submitted` | `processing` | `succeeded` | `failed` | `cancelled`  
Failures persist with sanitized error messages (no secrets).

Primary integration point: wrap of `submitAndPoll` in `packages/studio/src/muapi.js` (all Create studios inherit tracking).

---

## MuAPI provider adapter

`lib/dynaxis/providers/muapi.js` — `MuAPIProvider`:

- submit / retrieve(poll) / normalise status / extract outputs / cancel (honest unsupported)

Does **not** replace MuAPI. Does **not** add other providers.

Workflow / Agent / Design Agent MuAPI paths remain unchanged (future consumers).

---

## Project context

- `lib/dynaxis/client/project-context.js`
- Shell publishes `__dynaxisProjectId`, `__dynaxisFeatureId`, `__dynaxisAssetHint`
- Header project `<select>` (md+) + Settings project create/import

---

## API boundaries

All under `/api/dynaxis/*`, auth via `x-api-key` → `owner_ref`:

| Route | Methods |
|-------|---------|
| `/projects` | GET, POST |
| `/projects/[id]` | GET, PATCH |
| `/assets` | GET, POST |
| `/assets/[id]` | GET |
| `/generations` | GET, POST |
| `/generations/[id]` | GET |
| `/jobs/[id]` | GET |
| `/lifecycle/start\|provider-id\|complete\|fail` | POST |
| `/history/import` | POST |
| `/health` | GET |

Validation: Zod. Client: `createPlatformClient`.

---

## Ownership limitations

- Same MuAPI key ⇒ same `owner_ref` (expected)
- No workspace/org RBAC
- Not a full Dynaxis identity platform
- Preview key isolated: `ak_sha256:preview:local`

---

## Electron

| Immediate | Deferred |
|-----------|----------|
| Branding / local inference unchanged | Cloud project sync for desktop-only generations |
| Web lifecycle tracking when using hosted web app | Unifying Electron vanilla studios onto platform APIs |

Electron packaging IDs (`open-generative-ai`, `ai.generative.open`) untouched.

---

## Validation

| Check | Result |
|-------|--------|
| `npm run test:dynaxis` | Pass (16) |
| `node --test tests/*.test.js` | Pass (17) |
| `npm run build:packages` | Pass |
| `npm run build` (Next.js) | Pass |
| `npm run lint` | Upstream interactive ESLint setup (unchanged) |

---

## Deferred (Phase 4+)

- Mini-app module framework + first SamurAIGPT integrations
- Skills / Supercomputer / Dynaxis OS
- Full identity / workspaces / billing
- Dynaxis object storage
- Adopt lifecycle in Workflow / Agent / Design Agent packages
- Rich Asset Library UI (backend ready)

---

## Key paths

```text
lib/dynaxis/db/schema.js
lib/dynaxis/services/{projects,assets,generations,jobs,lifecycle,history-compat}.js
lib/dynaxis/providers/muapi.js
app/api/dynaxis/**
drizzle/0000_dynaxis_platform.sql
packages/studio/src/muapi.js   # lifecycle wrap
```
