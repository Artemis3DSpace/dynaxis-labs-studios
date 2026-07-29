# WP-7C-17 Route Migration: Design APIs and Mini App Execution — Handoff

## Scope

- Work Package: WP-7C-17 Route Migration: Design APIs and Mini App Execution
- Branch: `phase-7c/route-migration-design-mini-app`
- Worktree: `dynaxis-labs-studios-phase-7c-route-migration-design-mini-app`
- Base SHA: `4f496ff0fcd19a8505b17fce0a9843834143b25e`
- Migration owner: false
- Migration status: no migration added

## Implementation Summary

- Migrated Composition, Design Agent, Design Components, Component Sets, Design Systems, and Design Templates API routes from `withPlatformAuth()` to `withAuthContextRoute()` with `legacyCompatibility: true`.
- Added route partition helpers in `lib/dynaxis/services/compositions.js`: `DESIGN_ROUTE_LEGACY_COMPAT`, `resolveRouteOwnerRef()`, `providerApiKeyFromRequest()`, `findCompositionOwnership()`, `compositionOwnershipRepository`, and `requireCompositionRoutePermission()`.
- Added workspace design resource ownership lookups in `templates.js`, `components.js`, and `design-systems.js` (PostgreSQL path; memory store continues owner-ref partition isolation).
- Design Agent service now accepts `authScope` and validates Composition project/workspace scope before context assembly and mutations; provider `apiKey` is passed only as a generation credential, not identity.
- Mini App execution continues through platform API + `x-api-key` legacy compatibility path; runtime permission gates remain unchanged; server routes now enforce canonical permissions before design mutations.

## Route Permission Mapping

- Compositions: `composition.read|create|update|delete` with project resource inheritance where applicable.
- Design Agent actions: composition/design permissions per action; `plan` uses provider apiKey only for LLM adapter.
- Workspace design roots: `design_template.*`, `design_component.*`, `design_system.*`, `design_component_set.*` with `requireWorkspace: true`.
- Composition mutation subroutes (instantiate, detach, from-layers, switch-instance): `composition.update`.

## Validation Evidence

```bash
NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory \
  node --import ./tests/setup/allow-server-only.mjs --test \
  tests/dynaxis-compositions.test.mjs \
  tests/dynaxis-design-agent.test.mjs \
  tests/dynaxis-design-components.test.mjs \
  tests/dynaxis-design-systems.test.mjs \
  tests/dynaxis-templates.test.mjs \
  tests/dynaxis-miniapp-host-executor.test.mjs
```

- Result: **64 passed / 64**
- `git diff --check`: clean

## Blockers / Follow-ups

- Canonical Better Auth session subjects without a legacy owner partition cannot reach Design persistence yet (Compositions/Design rows remain owner-ref partitioned). Routes fail closed via `resolveRouteOwnerRef()` until a future persistence bridge (outside WP-7C-17 scope).
- `findCompositionOwnership()` and workspace design ownership lookups return `null` on memory driver; route-level resource inheritance falls back to loaded Composition row + `resolveProjectOrganization()` for tests.
- `MiniAppHost` / `lib/dynaxis/mini-apps/runtime.js` were not modified (outside allowed paths); mini-app permission enforcement remains client runtime + migrated server routes.

## Contract Deviations

- None. Better Auth remains identity primitive; no schema changes; no new Project entity; provider credentials are not identity subjects.
