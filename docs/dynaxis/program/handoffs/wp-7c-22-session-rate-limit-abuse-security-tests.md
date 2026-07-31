# WP-7C-22 Session Rate Limit Abuse and Security Tests — Handoff

## Scope

- Work Package: WP-7C-22 Session Rate Limit Abuse and Security Tests
- Branch: `phase-7c/session-rate-limit-abuse-security-tests`
- Base SHA: `ef80ee31056b3383238e9cb90772964104940cd4`
- Migration owner: false
- Status: review (not done)

## Coverage Matrix

| Required coverage | Test(s) | File |
|---|---|---|
| Rate-limit boundaries (existing primitive) | `WP-7C-22 security-critical auth options stay fixed regardless of attempted environment overrides` | `tests/dynaxis-auth-foundation.test.mjs` |
| Session fail-closed / invalid active organization | `WP-7C-22 user session with a stale active organization fails closed instead of granting workspace access` | `tests/dynaxis-auth-foundation.test.mjs` |
| Personal workspace delete/invite/member mutation abuse | `WP-7C-22 personal workspace organization hooks reject every governance mutation entry point` | `tests/dynaxis-workspace-foundation.test.mjs` |
| Owner demotion / remove-owner abuse (hook precision) | `WP-7C-22 personal workspace member role update hook allows role changes that keep ownership` | `tests/dynaxis-workspace-foundation.test.mjs` |
| Repeated provisioning/recovery abuse | `WP-7C-22 personal workspace provisioning resists repeated membership-drop abuse by repairing every time` | `tests/dynaxis-workspace-foundation.test.mjs` |
| No owner_ref identity authority | `WP-7C-22 personal workspace organization hooks never treat owner_ref as identity authority` | `tests/dynaxis-workspace-foundation.test.mjs` |
| Personal workspace governance denial across roles | `WP-7C-22 personal Workspace governance mutations stay denied for every role that would otherwise pass the role gate` | `tests/dynaxis-authorization-policy.test.mjs` |
| Authorization denial when session/workspace context is invalid | `WP-7C-22 membership loss denies personal Workspace governance mutations before the personal-workspace explicit deny is reached` | `tests/dynaxis-authorization-policy.test.mjs` |

## Review Findings

Reviewed implementation packages: WP-7C-11 (Authorization Regression Test
Suite), WP-7C-12 (Canonical AuthContext Contract), WP-7C-21 (Identity
Signup Provisioning and Recovery Hardening).

- `lib/dynaxis/auth/options.js`: rate limiting (`enabled: true, storage:
  'database', window: 10, max: 100`) and signup/account-linking lockdown
  (`disableSignUp: true`, `accountLinking.enabled: false`) are hardcoded,
  not derived from `env`. No attacker-reachable input path can weaken
  them; verified with a malicious-env test rather than trusting the
  existing single-env-shape assertion alone.
- `lib/dynaxis/auth/policy.js`: `PERSONAL_WORKSPACE_DENIED_PERMISSIONS`
  (`workspace.members.invite/update/remove`, `workspace.transfer`) is a
  second, independent protection layer above the Better Auth
  organization-hook layer (`workspace-protection.js`). Found and fixed a
  **test-only** assumption bug while writing the role-matrix abuse test:
  `workspace.transfer` requires the `owner` role only (not `admin`), so an
  `admin`-role personal-workspace attempt correctly resolves to
  `INSUFFICIENT_WORKSPACE_ROLE`, not `EXPLICIT_DENY`. The test now derives
  expected reasons from `getPermissionDefinition(...).workspaceRoles`
  instead of a hardcoded role list. No production code was affected by
  this fix.
- `lib/dynaxis/identity/workspace-protection.js`: the previously-tested
  surface was the internal `assertPersonalWorkspaceMutationAllowed`
  helper. Added coverage that exercises the actual wired Better Auth
  hook object (`createDynaxisWorkspaceOrganizationHooks`) across all six
  entry points (`beforeDeleteOrganization`, `beforeAddMember`,
  `beforeRemoveMember`, `beforeUpdateMemberRole`, `beforeCreateInvitation`,
  `beforeAcceptInvitation`), plus a precision control confirming a role
  update that keeps `owner` in the role string is not blocked.
- `lib/dynaxis/identity/personal-workspace.js` (WP-7C-21 hardening):
  confirmed resilient under a repeated corruption/repair cycle (membership
  dropped and re-provisioned three times in a row) — no duplicate
  organization or mapping row is ever created.
- `lib/dynaxis/auth/auth-context.js`: `requireAuthContextWorkspace` fails
  closed (`WORKSPACE_REQUIRED`) for a session whose active organization no
  longer has a valid membership, distinct from the already-tested
  no-workspace-at-all case.

No defects requiring a production code fix were found. No residual risks
identified within this Work Package's scope.

## Implementation Fixes

None. No production code in `lib/dynaxis/**` was modified. One test-file
assumption bug (see above) was corrected before landing.

## Tests Added

- `tests/dynaxis-auth-foundation.test.mjs`: 2 new tests
- `tests/dynaxis-workspace-foundation.test.mjs`: 4 new tests
- `tests/dynaxis-authorization-policy.test.mjs`: 2 new tests

## Validation Evidence

- `git diff --check`: clean
- `npm run program:status`: valid; WP-7C-22 listed under `review`
- `npm run test:dynaxis`: 438 passed / 439 (known baseline failure
  unchanged: `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`)

## Out of Scope (unchanged)

- No WP-7C-23 final integration gate
- No route, schema, or migration changes
- No Studio client screen changes
- No Provider Connections, Job Engine, App Factory, Marketplace, or Supercomputer work
- No auth/session/workspace service rewrite
- No migration ownership taken (migration_owner: false)
