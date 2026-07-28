# WP-7C-11 Authorization Regression Test Suite Handoff

## Scope

- Work Package: WP-7C-11 Authorization Regression Test Suite
- Branch: `phase-7c/authorization-regression-review`
- Worktree: `dynaxis-labs-studios-phase-7c-authorization-regression-review`
- Starting SHA: `30411b3a76517876228398e2a6df5f4b9dfc204d`
- Migration owner: false
- Migration status: no migration added
- Status: review/test evidence prepared; awaiting integration review

## Review/Test Plan

1. Verify WP-7C-11 readiness from programme metadata after `git fetch origin`.
2. Read programme rules, WP-7C-09/WP-7C-10/WP-7C-11 briefs, available handoff docs, and authorization/project-membership/workspace ownership specs.
3. Inspect current authorization implementation and existing tests for duplicate or missing coverage.
4. Add only bounded regression tests under `tests/dynaxis-authorization*.test.mjs`.
5. Validate targeted authorization tests, full authorization glob, feasible broader suites, programme status, and whitespace.

## Coverage Matrix

| Package | Contract / acceptance criterion | Regression evidence |
| --- | --- | --- |
| WP-7C-09 | Policy evaluator returns deterministic results for every Workspace role. | `tests/dynaxis-authorization-policy.test.mjs`: `Workspace policy matrix matches the permission registry`, `Workspace-scoped settings follow the canonical Workspace role matrix`. |
| WP-7C-09 | Deny by default for unknown permission, missing subject, inactive/missing session, missing Workspace, missing Workspace membership, or unsupported authority. | `tests/dynaxis-authorization-policy.test.mjs`: `unsupported and future principals remain ungranted`, `stable decision precedence is table-driven`, `Workspace access adapter does not treat stale active organization as membership`. |
| WP-7C-09 | Better Auth organization membership is Workspace membership only, not Project membership. | `tests/dynaxis-authorization-policy.test.mjs`: `Workspace roles do not imply Project roles`, `Project-scoped Design never grants from Workspace role`, `Project-scoped settings never grant from Workspace role in the base evaluator`. |
| WP-7C-09 | Permission vocabulary is canonical and exported without inventing a second principal vocabulary. | `tests/dynaxis-authorization-policy.test.mjs`: `permission registry exports canonical immutable permission metadata`, `Workspace matrix covers canonical Workspace-owned domains`; `tests/dynaxis-authorization-project-policy.test.mjs`: `Project inherited permission vocabulary covers every child action under review`. |
| WP-7C-09 | Structured failure codes do not leak secrets, provider credentials, raw API keys, or membership metadata. | `tests/dynaxis-authorization-policy.test.mjs`: `authorization decisions do not echo sensitive input fields`; `tests/dynaxis-authorization-project-policy.test.mjs`: `Project policy decisions do not echo sensitive payloads or membership metadata`, `Resource inheritance resolves repository resources without echoing sensitive metadata`. |
| WP-7C-10 | Project role matrix covers owner/admin/editor/viewer. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Project role helpers expose the canonical role matrix`, `Project policy allows and denies owner admin editor viewer deterministically`. |
| WP-7C-10 | Workspace membership without explicit Project membership cannot grant Project-scoped editor/admin actions unless policy explicitly grants an override. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Workspace membership without explicit Project membership cannot grant project access`, `Project policy ignores caller-supplied membership shortcuts`, `Project policy rejects malformed service-returned membership rows`. |
| WP-7C-10 | Child resource authorization derives from canonical Project relationship. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Resource inheritance covers representative Project child domains`, `Resource inheritance covers aliases and generation/job lifecycle permutations`, `Resource inheritance resolves repository resources without echoing sensitive metadata`, `Resource inheritance requires canonical Project context for child resources`. |
| WP-7C-10 | Representative child domains include Assets, Generations, Jobs, Campaigns, Compositions, project-scoped Character/Product/Brand uses, and Design resources. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Project inherited permission vocabulary covers every child action under review`, `Resource inheritance covers representative Project child domains`, `Resource inheritance covers aliases and generation/job lifecycle permutations`. |
| WP-7C-10 | Do not flatten `organization_id` onto every child; infer through Project and deny scope mismatches safely. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Resource inheritance denies scope mismatches before role grants`, `Resource inheritance rejects create requests for mismatched target Project Workspace`. |
| WP-7C-10 | Reusable Workspace roots do not inherit ownership merely because linked to a Project. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Resource inheritance does not transfer reusable root ownership`. |
| WP-7C-10 | Not-found versus forbidden outcomes remain structured and safe. | `tests/dynaxis-authorization-project-policy.test.mjs`: `Project policy distinguishes safe not-found and forbidden outcomes`, `Resource inheritance distinguishes missing resources from forbidden membership`, `Resource inheritance rejects provider credentials before resource disclosure`. |

## Added Regression Coverage

- Added project-scoped `settings.manage` owner/admin/editor/viewer matrix coverage.
- Added inherited permission vocabulary coverage for every child action under WP-7C-10 review, including project-scoped reusable-root use types.
- Added repository-backed resource inheritance coverage that verifies lookup input and prevents sensitive fetched metadata from appearing in authorization decisions.
- Added mismatched target Project Workspace coverage for create-time inherited resources.

## Defects And Required Fixes

- No runtime defects were found that require an implementation fix before integration.
- No failing regression was intentionally left behind.

## Residual Risks

- No WP-7C-09 handoff file exists under `docs/dynaxis/program/handoffs/**` in this checkout. Review evidence for WP-7C-09 therefore relies on the integrated work-package brief, authorization specification, implementation inspection, and existing tests.
- This linked worktree has no local `node_modules`; validation used the main checkout dependency tree through a temporary Node ESM resolver in `/private/tmp`. The initial unassisted authorization glob failed with `ERR_MODULE_NOT_FOUND` for `better-auth` and `drizzle-orm`.
- WP-7C-11 did not make route/AuthContext/client migration assertions because WP-7C-12 and later route migration packages remain backlog and are explicitly out of scope.

## Validation Evidence

- Baseline complete authorization glob before edits:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import /private/tmp/dynaxis-worktree-deps-register.mjs --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization*.test.mjs`
  - Result: 34 passed / 34 total.
- Targeted WP-7C-11 project/resource authorization test after edits:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import /private/tmp/dynaxis-worktree-deps-register.mjs --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization-project-policy.test.mjs`
  - Result: 22 passed / 22 total.
- Complete authorization glob after edits:
  - `NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 DYNAXIS_ASSET_STORAGE=memory node --import /private/tmp/dynaxis-worktree-deps-register.mjs --import ./tests/setup/allow-server-only.mjs --test tests/dynaxis-authorization*.test.mjs`
  - Result: 38 passed / 38 total.
- Full Dynaxis suite:
  - `NODE_OPTIONS="--import /private/tmp/dynaxis-worktree-deps-register.mjs" npm run test:dynaxis`
  - Result: 358 passed / 361 total; 3 PostgreSQL tests failed before assertions because `/opt/homebrew/bin/initdb` could not create a System V shared-memory segment.
  - Failing tests: `PostgreSQL regression: claimed legacy Project requires projected ownership`, `PostgreSQL concurrency: concurrent final owner removal cannot leave zero owners`, `PostgreSQL concurrency: concurrent final owner demotion cannot leave zero owners`.
  - Exact blocker: `FATAL: could not create shared memory segment: No space left on device`; `DETAIL: Failed system call was shmget(..., size=56, 03600)`; `HINT: This error does not mean that you have run out of disk space. It occurs either if all available shared memory IDs have been taken ... or because the system's overall limit for shared memory has been reached.`
- Complete test command:
  - `NODE_OPTIONS="--import /private/tmp/dynaxis-worktree-deps-register.mjs" npm test`
  - Result: top-level `tests/*.test.js` passed 17 / 17; nested `npm run test:dynaxis` reached 358 passed / 361 total with the same 3 PostgreSQL shared-memory failures above.
- Programme status:
  - `NODE_OPTIONS="--import /private/tmp/dynaxis-worktree-deps-register.mjs" npm run program:status`
  - Result: passed; WP-7C-11 is `in_progress`, WP-7C-12 remains `backlog`.
- Whitespace:
  - `git diff --check`
  - Result: passed.

## Integration Gate

- Leave branch unmerged.
- Do not mark WP-7C-11 done until integration is complete.
- Do not make WP-7C-12 ready or start it.
- User or integration owner is the final merge authority.
