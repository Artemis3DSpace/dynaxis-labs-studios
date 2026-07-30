# WP-7C-19 Client Session and Workspace Switching — Handoff

## Scope

- Work Package: WP-7C-19 Client Session and Workspace Switching
- Branch: `phase-7c/client-session-workspace-switching`
- Base SHA: `1a63958ea8c0ca3be61f24b35b0ac3e54aa3d3d9`
- Migration owner: false
- Status: review (not done)

## Implementation Summary

- Extended `lib/dynaxis/auth/client.js` with session projection helpers, `fetchDynaxisAuthSession()`, `switchDynaxisActiveOrganization()`, and `listDynaxisOrganizations()` using Better Auth as workspace authority.
- Hardened `lib/dynaxis/client/project-context.js` with session hydration, subscribe APIs, owner_ref rejection, and non-authoritative workspace hints (session remains canonical).
- Added `packages/studio/src/session/` with `createWorkspaceSessionController`, `DynaxisSessionProvider`, and Studio hooks for workspace/project switching.
- Workspace switch clears project context, resets TanStack Query cache via WP-7C-18 invalidation helpers, and republishes session-derived workspace context.
- Project switch invalidates project-scoped queries without cross-workspace cache reuse.

## Validation Evidence

- `tests/dynaxis-client-session-workspace.test.mjs`: 10 passed / 10
- `npm run test:dynaxis`: 415 passed / 416 (known baseline failure unchanged)
- `npm run program:status`: valid; WP-7C-19 review; WP-7C-20 not started

## Out of Scope (unchanged)

- No route/server auth kernel changes
- No schema/migrations
- No Studio screen migration (WP-7C-20)
- No Provider Connections, Job Engine, App Factory, Marketplace, or Supercomputer
