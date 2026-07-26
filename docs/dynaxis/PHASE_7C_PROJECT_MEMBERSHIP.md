# Phase 7C.5 - Project Membership Schema

## Status

Phase 7C.5 adds the canonical Dynaxis Project membership persistence model. It
does not complete Phase 7C.

## Ownership Boundary

Dynaxis Project remains the canonical Project model in `public.dynaxis_projects`.

Better Auth remains the Workspace identity and membership primitive through:

- `auth.organization`
- `auth.user`
- `auth.member`

Dynaxis Project membership is represented by:

- `public.dynaxis_project_members`

No duplicate Workspace, Project, or user model is introduced.

## Project Roles

Project roles are exactly:

- `owner`
- `admin`
- `editor`
- `viewer`

These roles are not the same as Workspace roles. Workspace roles remain:

- `owner`
- `admin`
- `member`
- `viewer`

Project `editor` is intentionally distinct from Workspace `member`.

## Database Invariants

The database enforces:

- every Project member references an existing `dynaxis_projects.id`
- every Project member references an existing `auth.organization.id`
- every Project member references an existing `auth.user.id`
- every Project member references an existing Better Auth workspace membership
  through `(organization_id, user_id) -> auth.member(organization_id, user_id)`
- every represented Project member uses the Project's canonical Workspace
  through `(project_id, organization_id) -> dynaxis_projects(id, organization_id)`
- duplicate `(project_id, user_id)` Project membership is rejected
- Project deletion cascades to Project membership rows
- Organization deletion is restricted by canonical Workspace-owned Project rows
  and direct Project membership organization references
- user deletion cascades to Project membership rows, matching Better Auth's
  user-owned membership cleanup behavior
- deleting a Better Auth workspace membership cascades Project membership rows
  for that `(organization_id, user_id)`

The composite Project/Workspace invariant requires canonical Projects that are
represented in `dynaxis_project_members` to have non-null `organization_id`.
Historical legacy-only Projects with nullable `organization_id` remain compatible
with Phase 7C migration history but cannot gain canonical Project membership
until ownership projection supplies a canonical Workspace.

## Deferred Service Invariants

The database does not enforce every business rule:

- it does not decide who may create, update, or remove Project membership
- it does not elect or preserve exactly one Project owner
- it does not implement RBAC/ABAC authorization evaluation
- it does not determine whether a personal Workspace Project membership row is
  being created only for the personal Workspace owner

Those checks belong to later Phase 7C service and authorization work, beginning
with WP-7C-06.

## Personal Workspaces

Personal Workspaces remain single-member Workspaces. At this stage, personal
Workspace Projects remain compatible with owner-only Project membership semantics
because `dynaxis_project_members` must reference an existing Better Auth
membership for the same `(organization_id, user_id)`.

Arbitrary sharing of personal Workspace Projects is not introduced here.

## Out Of Scope

Phase 7C.5 does not implement:

- authorization policy evaluation
- route authorization migration
- public Project-sharing endpoints
- Project invitation flows
- Workspace role changes
- personal Workspace provisioning changes
- Provider Connections / Secrets
- Dynaxis API keys
