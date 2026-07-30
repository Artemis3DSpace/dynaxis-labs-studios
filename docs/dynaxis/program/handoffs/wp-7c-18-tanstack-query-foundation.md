# WP-7C-18 TanStack Query Foundation and Query Keys — Handoff

## Scope

- Work Package: WP-7C-18 TanStack Query Foundation and Query Keys
- Branch: `phase-7c/tanstack-query-foundation`
- Worktree: `dynaxis-labs-studios-phase-7c-tanstack-query-foundation`
- Base SHA: `8cf88bb38b719286998144cb8069f023a4df56ae`
- Migration owner: false
- Status: review (not done)

## Implementation Summary

- Added centralized query key factory at `packages/studio/src/query/keys.js` covering session, workspace, projects, assets, generations, jobs, characters, products, brands, campaigns, compositions, design resources, and mini app execution scopes.
- Keys are deterministic and scoped by Better Auth `organizationId` and canonical `projectId`; `owner_ref` is rejected in filters and scope helpers.
- Added TanStack Query client foundation (`createDynaxisQueryClient`, `DynaxisQueryProvider`) with auth/forbidden-aware retry and optimistic rollback boundaries.
- Added invalidation helpers for workspace switching, project switching, and platform error-driven cache invalidation.
- Extended `lib/dynaxis/client/platform-api.js` with `sessionPlatformFetch()` and shared `createPlatformFetchError()`.
- Extended `lib/dynaxis/client/project-context.js` with workspace context publish/read helpers for query cache separation.

## Validation Evidence

- `tests/dynaxis-client-query-foundation.test.mjs`: 9 passed / 9
- `npm run test:dynaxis`: 405 passed / 406 (known baseline failure unchanged)
- `npm run program:status`: valid; WP-7C-18 review; WP-7C-19 not started

## Out of Scope (unchanged)

- No route/server auth kernel changes
- No schema/migrations
- No Studio screen migration (WP-7C-19)
- No TanStack Router or TanStack Start

## Dependency Note

- Added `@tanstack/react-query` to `packages/studio/package.json`; root `package-lock.json` updated accordingly.
