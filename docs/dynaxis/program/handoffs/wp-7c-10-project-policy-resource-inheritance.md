# WP-7C-10 Project Policy And Resource Inheritance Handoff

## Scope

- Work Package: WP-7C-10 Project Policy and Resource Inheritance
- Branch: `phase-7c/project-policy-resource-inheritance`
- Worktree: `dynaxis-labs-studios-phase-7c-project-policy-resource-inheritance`
- Starting SHA: `b94e912db858cf7e1ce915f6ceae5e968726e488`
- Migration owner: false
- Migration status: no migration added
- Status: implementation validated locally with independent read-only review findings repaired; awaiting integration

## Implementation Summary

- Added `lib/dynaxis/auth/project-policy.js`.
- Added `lib/dynaxis/auth/resource-policy.js`.
- Added focused authorization tests in `tests/dynaxis-authorization-project-policy.test.mjs`.
- Updated existing authorization test labels so the base WP-7C-09 evaluator remains distinct from the WP-7C-10 adapters.
- Updated programme state for WP-7C-10 to `in_progress`; WP-7C-11 remains backlog.

## Policy Semantics

- Project roles are explicit: `owner`, `admin`, `editor`, `viewer`.
- Workspace membership is required but never translated into a Project role.
- Project membership is resolved through the canonical `ProjectMembershipService.get` boundary.
- Canonical Project authorization requires the Project workspace to match the active Workspace context.
- Legacy principals and provider credentials remain denied by default for canonical Project policy.
- Decisions use stable authorization reasons and bounded public metadata only.

## Resource Inheritance Semantics

- Resource authorization inherits through Project context for Assets, Generations, Jobs, Campaigns, Compositions, project-scoped Character/Product/Brand use resources, and project-scoped Design resources.
- Character, Product, Brand, and concrete Design library reusable roots remain Workspace-owned unless the operation is explicitly Project-scoped through a supported Project resource type.
- Create operations authorize through the target Project.
- Missing resources and cross-scope mismatches are reported as not-found-shaped denials where safe.
- Known Projects with missing or insufficient explicit Project membership are forbidden-shaped denials.

## Validation Evidence

- Targeted WP-7C-10 authorization test:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization-project-policy.test.mjs`
  - Result: 17 passed / 17 total
- Complete authorization test file glob:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization*.test.mjs`
  - Result: 33 passed / 33 total
- Full Dynaxis suite:
  - `npm run test:dynaxis`
  - Sandboxed result: 353 passed / 356 total; 3 PostgreSQL tests failed because sandboxed `initdb` could not create a shared memory segment.
  - Escalated result: 356 passed / 356 total
- Complete test command:
  - `npm test`
  - Sandboxed result: 17 passed / 17 total for `tests/*.test.js`; nested `test:dynaxis` reached 353 passed / 356 total with the same PostgreSQL shared-memory blocker.
  - Escalated retries: 17 passed / 17 total for `tests/*.test.js`; nested `test:dynaxis` reached 353 passed / 356 total but the 3 PostgreSQL startup checks still failed because the host System V shared-memory limit was exhausted after repeated PostgreSQL test startup attempts.
  - Note: standalone escalated `npm run test:dynaxis` passed 356 passed / 356 total before the host shared-memory exhaustion affected subsequent nested `npm test` runs.
- Package build:
  - `npm run build:packages`
  - Result: passed after initializing required git submodules in the linked worktree.
- Application build:
  - `npm run build`
  - Result: passed
- Programme status:
  - `npm run program:status`
  - Result: passed; WP-7C-10 is `in_progress`, WP-7C-11 remains backlog.
- Whitespace:
  - `git diff --check`
  - Result: passed.

## Independent Review Outcomes

Read-only review requests completed before integration:

- Authorization correctness and deny-by-default behavior: repaired caller-supplied membership bypass, exported resolver allow-without-principal behavior, and role-before-scope precedence.
- Security, tenancy isolation, and information leakage: repaired preloaded membership trust and resource disclosure ordering concerns.
- Project/resource inheritance semantics: repaired raw Character/Product/Brand root inheritance and concrete Design library root inheritance.
- Test completeness and missing edge cases: added project-member/settings matrix, membership service error mapping, reusable-root non-inheritance, alias/lifecycle coverage, provider-credential resource disclosure coverage, and missing-principal resolver coverage.
- Roadmap, allowed-path, and architecture compliance: repaired caller-supplied membership trust, raw reusable-root inheritance, and workspaceId alias widening; no migration or forbidden path changes were introduced.

## Integration Gate

- Leave branch unmerged.
- Do not mark WP-7C-10 done until integration is complete.
- Do not make WP-7C-11 ready before WP-7C-10 is integrated.
- User or integration owner is the final merge authority.
