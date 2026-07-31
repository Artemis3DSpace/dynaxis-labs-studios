# WP-7C-21 Identity Signup Provisioning and Recovery Hardening — Handoff

## Scope

- Work Package: WP-7C-21 Identity Signup Provisioning and Recovery Hardening
- Branch: `phase-7c/identity-signup-provisioning-recovery-hardening`
- Base SHA: `f1696fda62dace319c5f1623929bd63f2d01d379`
- Migration owner: false
- Status: review (not done)

## Implementation Summary

- Hardened `ensurePersonalWorkspaceForUser` in
  `lib/dynaxis/identity/personal-workspace.js` so a personal workspace
  mapping row is never trusted on its own: every resolution (fast path and
  the transactional create/reread path) now runs
  `recoverPersonalWorkspaceIntegrity`, which re-verifies the backing
  Better Auth organization and owner membership before returning.
- Missing owner membership is repaired idempotently (insert with
  `onConflictDoNothing`, same primitive the creation path already used).
- A membership row present but downgraded away from `owner` (e.g. by a
  direct write that bypassed the workspace-protection hooks) is restored
  to `owner` via a targeted `UPDATE` scoped to that single
  `(organizationId, userId)` row.
- A mapping that references an organization that no longer exists fails
  closed with a new, explicit error code
  (`DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING`) instead of silently
  continuing or inventing a replacement organization.
- No changes were needed to `lib/dynaxis/auth/options.js`,
  `lib/dynaxis/auth/server.js`, or `lib/dynaxis/identity/session-workspace.js`:
  the existing session-create hook (`resolveSessionActiveOrganization`)
  already converges a missing/invalid `activeOrganizationId` onto the
  user's personal workspace on every session creation, and now inherits
  the new integrity repair for free because it calls
  `ensurePersonalWorkspaceForUser` on every invocation.
- Personal workspace delete/share protections
  (`lib/dynaxis/identity/workspace-protection.js`) were reviewed and left
  unchanged; they already block organization deletion, invitations, member
  addition/removal, and owner-role demotion for personal workspaces.

## Recovery Behavior

- Partially existing rows tolerated: user-only, user+org (mapping/member
  missing), user+org+mapping (member missing or downgraded) all converge
  to a single canonical personal workspace with an owner membership row.
- Never invents unrelated organizations: an orphaned mapping (organization
  missing) is a fail-closed error, not an auto-created replacement.
- `owner_ref` is not read or referenced anywhere in
  `personal-workspace.js` or `session-workspace.js` (asserted by test).
- Legacy `owner_ref` claim/projection code
  (`lib/dynaxis/identity/legacy-owner-claims.js`,
  `lib/dynaxis/identity/workspace-ownership.js`) was not touched.

## Personal Workspace Protection Summary

- No changes to `workspace-protection.js`; existing coverage (deletion,
  invitations, member add/remove, owner-role demotion) verified still
  passing under the hardened provisioning path.

## Tests Added/Changed

In `tests/dynaxis-workspace-foundation.test.mjs`:

- `personal workspace provisioning repairs a missing owner membership row`
- `personal workspace provisioning restores a downgraded owner role`
- `personal workspace provisioning fails closed when the mapped organization is missing`
- `personal workspace provisioning converges safely across repeated calls after a repair`
- `WP-7C-21 personal and session workspace provisioning never treat owner_ref as identity authority`
- Extended the fake db test double with an `update()` primitive to exercise the owner-role restore path.
- Fixed an existing fixture gap: `session workspace hook initializes missing active organization to personal workspace` previously exercised a mapping row with no backing organization/member rows; it now sets up a complete, realistic fixture (this is what the new fail-closed check correctly caught on first run).

## Validation Evidence

- `git diff --check`: clean
- `npm run program:status`: valid; WP-7C-21 listed under `review`
- `npm run test:dynaxis`: 430 passed / 431 (known baseline failure unchanged: `tests/dynaxis-auth-context-route-context.test.mjs`, `ERR_MODULE_NOT_FOUND` for `next/server`)

## Out of Scope (unchanged)

- No WP-7C-22 abuse/rate-limit tests
- No WP-7C-23 final integration gate
- No Studio client screen changes
- No Provider Connections, Job Engine, App Factory, Marketplace, or Supercomputer work
- No unrelated schema changes, route migrations, or auth kernel rewrite
- No migration ownership taken (migration_owner: false)
