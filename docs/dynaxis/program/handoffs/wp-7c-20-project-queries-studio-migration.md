# WP-7C-20 Project Queries and Studio Migration — Handoff

## Scope

- Work Package: WP-7C-20 Project Queries and Studio Migration
- Branch: `phase-7c/project-queries-studio-migration`
- Base SHA: `07e46ec00e4934fb4244ed151e194c391bb45443`
- Migration owner: false
- Status: review (not done)

## Implementation Summary

- Extended `lib/dynaxis/client/platform-api.js` with session-scoped Project APIs (`sessionListProjects`, `sessionGetProject`, `sessionCreateProject`, `sessionUpdateProject`, `sessionArchiveProject`).
- Added `packages/studio/src/projects/` with workspace-aware query hooks, mutation invalidation, selection helpers, and `ProjectSessionBridge`.
- Added `packages/studio/src/providers/DynaxisStudioProviders.jsx` composing Query + Session + Project bootstrap.
- Project queries use WP-7C-18 `dynaxisQueryKeys.projects.*`; mutations invalidate catalog and detail prefixes.
- `ProjectSessionBridge` consumes WP-7C-19 session context, auto-selects default project, clears selection on workspace switch, and optionally renders a minimal project picker.

## Validation Evidence

- `tests/dynaxis-client-project-queries.test.mjs`: 9 passed / 9
- `npm run test:dynaxis`: 424 passed / 425 (known baseline failure unchanged)
- `npm run program:status`: valid; WP-7C-20 review; WP-7C-21/22/23 not started

## Out of Scope (unchanged)

- No route/server auth kernel changes
- No schema/migrations
- No full Studio UI rebuild
- No WP-7C-21/22/23 identity hardening or integration gate
- No Provider Connections, Job Engine, App Factory, Marketplace, or Supercomputer
