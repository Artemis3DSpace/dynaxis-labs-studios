# Phase 7C.2 - Dynaxis Workspace / Organization Foundation

## Status

Phase 7C.2 establishes the first Dynaxis Workspace foundation. It continues
Phase 7C but does not complete Phase 7C.

Phase 7C.1 authentication foundation remains intact.

## Scope

Better Auth Organization is the Dynaxis Workspace identity and membership
primitive for this phase.

Dynaxis does not create duplicate `DynaxisOrganization`, `Workspace`, or
`Membership` tables. Dynaxis product semantics are layered on top of Better Auth
organization primitives.

## Pinned Better Auth Reference

The installed and generated reference is Better Auth `1.6.23`.

The pinned CLI schema reference was generated with:

`npx auth@1.6.23 generate`

Temporary output:

`/tmp/dynaxis-better-auth-1.6.23-organization-schema.ts`

That temporary file is not committed.

## Better Auth Organization Plugin

Server import path:

`better-auth/plugins`

Client import path:

`better-auth/client/plugins`

Access-control import path:

`better-auth/plugins/organization/access`

Enabled:

- Better Auth Organization plugin.
- Better Auth Organization client plugin.
- Static roles: `owner`, `admin`, `member`, `viewer`.
- `allowUserToCreateOrganization: false`.
- `disableOrganizationDeletion: true`.
- `teams.enabled: false`.
- `dynamicAccessControl.enabled: false`.

Not enabled:

- teams
- dynamic access control
- `organizationRole`
- API Key plugin
- device authorization
- agent auth
- social OAuth
- SSO / SCIM

## Auth Schema Additions

Phase 7C.2 adds these Better Auth-owned tables under `auth`:

- `auth.organization`
- `auth.member`
- `auth.invitation`

It also adds this session field:

- `auth.session.active_organization_id`

The plugin settings keep these tables absent:

- `auth.team`
- `auth.team_member`
- `auth.organization_role`

Dynaxis keeps UUID auth identifiers with `advanced.database.generateId: "uuid"`.

## Personal Workspace Mapping

Personal workspace semantics live in `public.dynaxis_personal_workspaces`.

Columns:

- `user_id uuid not null`
- `organization_id uuid not null`
- `created_at timestamp not null`

Constraints:

- primary key on `user_id`
- unique `organization_id`
- `user_id` references `auth.user.id` with cascade delete
- `organization_id` references `auth.organization.id` with cascade delete

A Better Auth organization is personal only if it appears in this mapping.
Normal organization workspaces are Better Auth organizations not present in this
mapping. There is no `workspace_type` column on `auth.organization`.

## Provisioning

`ensurePersonalWorkspaceForUser(user)` is server-only and idempotent.

It uses the shared Dynaxis Drizzle/PostgreSQL connection and no second pool.

Provisioning strategy:

- read existing personal mapping first
- create a stable personal organization slug from immutable user ID
- create `auth.organization`
- create owner `auth.member`
- create `public.dynaxis_personal_workspaces`
- rely on database uniqueness as the concurrency boundary
- on conflict, re-read the existing mapping

The direct writes to Better Auth tables are intentionally isolated to personal
workspace provisioning because Better Auth cannot share a Dynaxis transaction
through its public organization API in this version.

## Protections

Personal workspaces are private, single-member workspaces.

Server-side Better Auth organization hooks reject:

- personal organization deletion
- personal workspace invitations
- adding another member
- removing the owning user
- demoting the owner from owner
- accepting an invitation into a personal workspace

The global Better Auth option `disableOrganizationDeletion` remains enabled as
an additional guard.

## Active Workspace

Phase 7C.2 uses Better Auth Organization active organization session support.

When a session is created:

- personal workspace is ensured
- missing active organization is initialized to the personal workspace
- an already valid active organization is preserved

No second active-workspace cookie or localStorage state is added.

## Migration

Migration file:

`drizzle/0010_phase_7c_2_workspace_foundation.sql`

The migration is generated and inspected but not applied by this phase.

## Out Of Scope

This subphase does not implement:

- public signup
- project membership
- canonical route-level `AuthContext`
- Dynaxis API keys
- RBAC/ABAC domain permissions
- Provider Connections / Secrets
- MuAPI credential migration
- new generation providers
- queues, workers, webhooks, or retries
- App Factory
- Composer
- Auto Layout
- Skills
- Supercomputer
