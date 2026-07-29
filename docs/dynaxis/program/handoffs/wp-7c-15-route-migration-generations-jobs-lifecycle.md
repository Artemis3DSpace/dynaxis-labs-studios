# WP-7C-15 Route Migration: Generations Jobs and Lifecycle — Handoff

## Scope

- Work Package: WP-7C-15 Route Migration: Generations Jobs and Lifecycle
- Branch: `phase-7c/route-migration-generations-jobs`
- Worktree: `dynaxis-labs-studios-phase-7c-route-migration-generations-jobs`
- Base SHA: `4f496ff0fcd19a8505b17fce0a9843834143b25e` (`origin/main`)
- Migration owner: **false**
- Migration status: no migration added

## Implementation Summary

- Migrated Generations, Jobs, and lifecycle API routes from `withPlatformAuth()` to
  `withAuthContextRoute()` with explicit `legacyCompatibility: true`.
- Added AuthContext-aware service helpers in `generations.js`, `jobs.js`, and
  `lifecycle.js` (`*ForRoute`, trusted ownership registry, resource repositories).
- Canonical (non-legacy) requests enforce project permissions via
  `requireRoutePermission()` before reads or lifecycle mutations.
- Legacy `x-api-key` partition behavior is preserved for provider-kernel / Studio
  submit-and-poll compatibility.

## Route Permissions

| Route | Canonical permission | Notes |
| --- | --- | --- |
| `GET /generations` | `generation.read` | Requires `projectId` |
| `POST /generations` | `generation.create` | Requires `projectId` |
| `GET /generations/:id` | `generation.read` | Resource inheritance |
| `GET /jobs/:id` | `job.read` | Resource inheritance |
| `POST /lifecycle/start` | `generation.create` | Requires `projectId` |
| `POST /lifecycle/provider-id` | `generation.create` | Resource inheritance on generation |
| `POST /lifecycle/complete` | `generation.create` | Resource inheritance on generation |
| `POST /lifecycle/fail` | `generation.create` | Resource inheritance on generation |

## Persistence Blocker (Canonical Generations/Jobs)

WP-7C-24 added canonical persistence for **Projects and Assets only**.
`dynaxis_generations.owner_ref` and `dynaxis_jobs.owner_ref` remain `NOT NULL`
with no canonical store APIs (`createCanonicalGeneration`, `findGenerationOwnership`,
etc.).

**Impact:**

- Legacy `x-api-key` routes: full create/read/lifecycle behavior unchanged.
- Canonical Better Auth sessions: authorization gates run, but create/start and
  list mutations return `503` with a bounded persistence-bridge message unless
  a trusted in-process ownership registry entry exists (tests / same-process
  lifecycle) or the owning Project still carries a legacy `owner_ref`.
- Production Studio lifecycle via MuAPI client continues on the legacy partition.

**Not invented:** no synthetic `owner_ref` values; no schema changes in this WP.

## Validation Evidence

- `tests/dynaxis-provider-kernel.test.mjs` — provider-kernel plus lifecycle route
  helper regression (legacy flow, stale-job rejection, canonical create blocked).
- `tests/dynaxis-platform-services.test.mjs` — lifecycle service regression (run
  with full dynaxis suite).
- `git diff --check` — run before integration.

## Files Changed

- `app/api/dynaxis/generations/**`
- `app/api/dynaxis/jobs/**`
- `app/api/dynaxis/lifecycle/**`
- `lib/dynaxis/services/generations.js`
- `lib/dynaxis/services/jobs.js`
- `lib/dynaxis/services/lifecycle.js`
- `tests/dynaxis-provider-kernel.test.mjs`
- `docs/dynaxis/program/handoffs/wp-7c-15-route-migration-generations-jobs-lifecycle.md`

## Deviations

- Route compatibility helpers (`isLegacyRouteCompatibility`,
  `legacyOwnerRefFromRoute`) live in `generations.js` because WP-7C-14
  project/asset route helpers are not yet integrated on `main`.
- Trusted ownership registry is a service-layer bridge until a future persistence
  WP adds store-level `findGenerationOwnership` / `findJobOwnership`.
