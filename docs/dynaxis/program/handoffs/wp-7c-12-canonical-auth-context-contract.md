# WP-7C-12 Canonical AuthContext Contract Handoff

## Scope

- Work Package: WP-7C-12 Canonical AuthContext Contract
- Branch: `phase-7c/auth-context-contract`
- Worktree: `dynaxis-labs-studios-phase-7c-auth-context-contract`
- Starting SHA: `31f2bc9455d4edff747e930e0c5f078d6b9edc14`
- Migration owner: false
- Migration status: no migration added
- Status: integrated on `main` from `phase-7c/auth-context-contract`

## Implementation Summary

- Added `lib/dynaxis/auth/auth-context.js`.
- Extended `lib/dynaxis/auth/server.js` with canonical AuthContext loader and helper exports.
- Extended `lib/dynaxis/identity/session-workspace.js` with sanitized active Workspace lookup helpers.
- Added focused tests in `tests/dynaxis-auth-context-contract.test.mjs`.
- Updated programme metadata so WP-7C-12 is `done`; WP-7C-13 and WP-7C-18 are ready/unassigned.

## AuthContext Semantics

- AuthContext exposes sanitized `subject`, evaluator-compatible `principal`, `session`, `workspace`, optional `project`, permission projection inputs, and explicit legacy compatibility metadata.
- Subject kinds are distinct: `anonymous`, `user`, `legacy`, and future `service-account`.
- User subjects project to the WP-7C-09 `human` authorization principal only through Better Auth session identity.
- Legacy subjects project only through explicit `legacyCompatibility` or direct compatibility construction and contain derived `legacyOwnerRef`, never raw `x-api-key`.
- Service-account subjects project to the existing deny-by-default `service/internal` principal shape for future work; no Phase 7C grants are added.
- Provider credentials, model accounts, and worker adapters are rejected as identity-subject inputs.
- Better Auth session/user/member rows are normalized to small plain objects before entering AuthContext; domain services are not handed raw Better Auth objects.

## Workspace And Project Semantics

- The session loader uses `auth.api.getSession({ headers })` and active Better Auth organization state.
- Active Workspace resolution verifies membership for `(activeOrganizationId, userId)` before projecting Workspace access.
- Personal Workspace state is projected as `isPersonal` without changing personal Workspace protections.
- Project resolution uses canonical `ProjectMembershipService.get` by default and projects only Project id, organization id, role, and membership presence.
- Missing Project membership remains represented as `isMember: false`; permission helpers deny through the existing WP-7C-10 policy surface.
- Project-owned resource and create-time permissions dispatch through WP-7C-10 resource inheritance; Workspace-owned roots remain Workspace-policy permissions.

## Legacy Compatibility Boundary

- Legacy `x-api-key` is ignored by default when loading AuthContext from a request.
- Legacy compatibility must be explicitly enabled through `legacyCompatibility: true` or direct legacy construction.
- Legacy compatibility derives `ownerRefFromApiKey()` server-side and never serializes raw keys.
- Legacy Project projection is marked `legacy-owner-ref-route` compatibility and does not become canonical Project membership authority.
- Existing routes and `withPlatformAuth()` were not migrated.

## Validation Evidence

- Targeted AuthContext tests:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-auth-context*.test.mjs`
  - Result after review repairs: 11 passed / 11 total.
- AuthContext plus relevant authorization tests:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-auth-context-contract.test.mjs tests/dynaxis-authorization-policy.test.mjs tests/dynaxis-authorization-project-policy.test.mjs`
  - Result after review repairs: 50 passed / 50 total.
- Complete authorization glob:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization*.test.mjs`
  - Result after review repairs: 39 passed / 39 total.
- Full Dynaxis suite:
  - `npm run test:dynaxis`
  - Result after review repairs: 370 passed / 373 total; 3 PostgreSQL tests failed before assertions because `initdb` could not create a System V shared-memory segment.
  - Exact blocker: `FATAL: could not create shared memory segment: No space left on device`; `DETAIL: Failed system call was shmget(..., size=56, 03600)`; PostgreSQL reported the host shared-memory limit or shared-memory IDs were exhausted.
- Complete test command:
  - `npm test`
  - Result after review repairs: top-level `tests/*.test.js` passed 17 / 17; nested `npm run test:dynaxis` reached 370 passed / 373 total with the same 3 PostgreSQL shared-memory failures above.
- Package build:
  - `npm run build:packages`
  - Result: passed after initializing git submodules and using a validation-only worktree `node_modules` symlink/directory to the main checkout dependency install.
- Application build:
  - `npm run build`
  - Result: passed after approved network access for `next/font` Google Fonts and worktree-local package aliases.
- Programme status:
  - `npm run program:status`
  - Result after integration transition: passed; WP-7C-12 is `done`, WP-7C-13 and WP-7C-18 are ready/unassigned.
- Whitespace:
  - `git diff --check`
  - Result after review repairs: passed.

## Independent Review Outcomes

- AuthContext contract correctness: repaired create-time/project-scoped permission dispatch through resource inheritance and added the missing handoff file.
- Security and identity isolation: no findings; reviewer independently validated AuthContext plus authorization policy tests at 47 / 47 before review-repair test additions.
- Legacy compatibility boundary: no findings; reviewer confirmed opt-in legacy ownerRef bridge and no route migration.
- Test completeness: repaired missing default Better Auth loader/server-wrapper coverage, default non-legacy `x-api-key` behavior, and missing Project membership AuthContext negative coverage.
- Allowed-path and programme compliance: no findings; reviewer confirmed allowed paths, no migration, and branch/worktree/base metadata before integration.

## Integration Result

- Branch integrated by fast-forwarding `main` to `14e8aa2a94a790cc6cbf5cecd7973cbaf300e4c1`.
- WP-7C-12 is marked done after integration.
- WP-7C-13 and WP-7C-18 are ready/unassigned after WP-7C-12 integration.
- No route migration, client/session migration, schema migration, Provider Connections, Developer Platform credentials, Better Auth replacement, or package manifest changes are included.
