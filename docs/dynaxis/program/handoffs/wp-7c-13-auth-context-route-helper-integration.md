# WP-7C-13 AuthContext Route Helper Integration Handoff

## Scope

- Work Package: WP-7C-13 AuthContext Route Helper Integration
- Branch: `phase-7c/auth-context-route-helper`
- Worktree: `dynaxis-labs-studios-phase-7c-auth-context-route-helper`
- Starting SHA: `373ab597b0ee66359d490b37876478ce8075cb50`
- Migration owner: false
- Migration status: no migration added
- Status: integrated on `main`

## Implementation Summary

- Added `lib/dynaxis/auth/route-context.js`.
- Extended `lib/dynaxis/api.js` to re-export the AuthContext route helper surface while preserving `withPlatformAuth()` and `requireOwnerFromRequest()` legacy behavior unchanged.
- Added focused route-helper coverage in `tests/dynaxis-auth-context-route-context.test.mjs`.
- Added migration guidance in `docs/dynaxis/AUTH_CONTEXT_ROUTE_HELPER_MIGRATION.md`.
- Updated WP-7C-13 programme metadata to `done`; WP-7C-14 through WP-7C-17 are ready for route migration work after integration.

## Route Helper Contract

- `loadRouteAuthContext()` adapts a Next.js `Request` to the canonical WP-7C-12 AuthContext.
- `requireRouteAuthContext()`, `requireRouteWorkspace()`, `requireRouteProject()`, and `requireRoutePermission()` provide route-level authn/authz gates.
- `withAuthContextRoute()` wraps Next.js route handlers and maps AuthContext failures to bounded JSON responses.
- Project-scoped permissions resolve Project context at the route boundary and use a per-request cached Project membership service so AuthContext project projection and authorization decisions come from the same underlying membership lookup.
- Resource inheritance helpers pass through `resource`, `resourceId`, `resourceType`, and `resourceRepository` so later route packages can authorize canonical resource ownership metadata without trusting route parameters.
- Project membership lookup failures raised while resolving route AuthContext Project context are mapped to bounded route-auth JSON before leaving `withAuthContextRoute()`.

## Error Mapping

Public route-auth JSON responses are intentionally small:

- 400: `DYNAXIS_ROUTE_AUTH_INVALID_REQUEST`
- 401: `DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED`
- 403: `DYNAXIS_ROUTE_AUTH_FORBIDDEN`
- 403 Workspace helper failures: `DYNAXIS_ROUTE_AUTH_WORKSPACE_REQUIRED`
- 404: `DYNAXIS_ROUTE_AUTH_NOT_FOUND`

Not-found-shaped denials omit resource scope mismatch details, membership rows, raw headers, Project lookup error codes, and authorization decision internals. `PROJECT_NOT_FOUND`, `PROJECT_WORKSPACE_UNRESOLVED`, and cross-workspace `WORKSPACE_MISMATCH` membership lookup failures all surface as the same public 404 response to avoid leaking Project existence across Workspace boundaries.

## Legacy Compatibility

- Legacy `x-api-key` compatibility is disabled by default.
- Compatibility requires `legacyCompatibility: true`; non-boolean values are rejected with 400 and cannot truthily enable legacy identity.
- Valid Better Auth sessions take precedence over a presented `x-api-key`, even when compatibility is enabled.
- Legacy compatibility derives server-side `ownerRef` through the WP-7C-12 compatibility path and never serializes the raw key.
- Route contexts expose bounded audit metadata: enabled, presented, used, source, mode, and derived ownerRef only when legacy identity was actually used.
- `withPlatformAuth()` remains as the existing auditable legacy bridge for unmigrated routes.

## Validation Evidence

- Focused AuthContext route helper tests:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import /private/tmp/dynaxis-worktree-deps-register.mjs --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-auth-context*.test.mjs`
  - Result after blocking review repair: 25 passed / 25 total.
- AuthContext plus relevant authorization tests:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import /private/tmp/dynaxis-worktree-deps-register.mjs --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-auth-context*.test.mjs tests/dynaxis-authorization-policy.test.mjs tests/dynaxis-authorization-project-policy.test.mjs`
  - Result after blocking review repair: 64 passed / 64 total.
- Full Dynaxis suite:
  - `NODE_OPTIONS="--import /private/tmp/dynaxis-worktree-deps-register.mjs" npm run test:dynaxis`
  - Result after review repairs: 382 passed / 385 total; 3 PostgreSQL tests failed before assertions because `initdb` could not create a System V shared-memory segment.
  - Failing tests: `PostgreSQL regression: claimed legacy Project requires projected ownership`, `PostgreSQL concurrency: concurrent final owner removal cannot leave zero owners`, `PostgreSQL concurrency: concurrent final owner demotion cannot leave zero owners`.
  - Exact blocker: `FATAL: could not create shared memory segment: No space left on device`; `DETAIL: Failed system call was shmget(..., size=56, 03600)`; `HINT: This error does *not* mean that you have run out of disk space. It occurs either if all available shared memory IDs have been taken ... or because the system's overall limit for shared memory has been reached.`
- Complete test command:
  - `NODE_OPTIONS="--import /private/tmp/dynaxis-worktree-deps-register.mjs" npm test`
  - Result after review repairs: top-level `tests/*.test.js` passed 17 / 17; nested `npm run test:dynaxis` reached 382 passed / 385 total with the same PostgreSQL shared-memory blocker.
- Package build:
  - `npm run build:packages`
  - Result: passed after initializing git submodules and using a validation-only worktree `node_modules` symlink to the main checkout dependency install.
- Application build:
  - `npm run build`
  - Result: passed. The first app build attempt failed on sandboxed Google Fonts DNS for `fonts.googleapis.com`; the approved network retry passed.
- Programme status:
  - `npm run program:status`
  - Result: passed; WP-7C-13 is `in_progress`; WP-7C-14 through WP-7C-17 remain backlog.
- Whitespace:
  - `git diff --check`
  - Result after review repairs: passed.

## Independent Review Outcomes

- Blocking final review: repaired escaping `ProjectMembershipServiceError` failures from route Project resolution. Missing Project and cross-workspace lookup failures now map through `withAuthContextRoute()` to `DYNAXIS_ROUTE_AUTH_NOT_FOUND` without leaking service codes or hidden scope details.
- Route-helper contract correctness: repaired anonymous project-scoped permission mapping to 401, added resource repository pass-through, and added per-request membership lookup caching to avoid inconsistent Project projection versus authorization state.
- Security and error disclosure: repaired unsafe migration-guide resource example so later route packages use trusted canonical resource metadata; no raw `x-api-key` disclosure was found.
- Legacy compatibility and auditability: repaired non-boolean `legacyCompatibility` truthiness so only explicit boolean `true` enables legacy identity.
- Test completeness: added coverage for session-over-legacy precedence, invalid auth request mapping, Workspace-required mapping, full API helper re-exports, permission projection, resource repository authorization, and cached membership lookups.
- Allowed-path and programme compliance: no findings; reviewer confirmed only allowed paths changed, no route migration, no schema/package/lockfile changes, no Provider Connections/API credential scope, WP-7C-13 not done, and WP-7C-14 through WP-7C-17 still backlog.

## Integration Gate

- Integrated by fast-forwarding `main` to `phase-7c/auth-context-route-helper`.
- WP-7C-14, WP-7C-15, WP-7C-16, and WP-7C-17 are ready after integration.
- WP-7C-19 remains backlog until WP-7C-18 is integrated.
