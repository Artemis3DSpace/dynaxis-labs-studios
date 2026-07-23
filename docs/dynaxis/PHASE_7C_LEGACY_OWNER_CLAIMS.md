# Phase 7C.3 - Legacy OwnerRef Claim Bridge

## Status

Phase 7C.3 establishes the durable bridge from historical MuAPI-key-derived
ownership to Dynaxis Workspaces. It does not complete Phase 7C.

## Why This Exists

Historical Dynaxis resources are owned by `owner_ref` values derived from the
legacy `x-api-key` path:

```text
raw MuAPI API key
-> ownerRefFromApiKey()
-> ak_sha256:<sha256>
-> owner_ref on historical resources
```

Phase 7C.3 creates a one-way claim from a historical `owner_ref` to a Better
Auth organization, which is the Dynaxis Workspace primitive.

## Raw Key Security

The normal claim path accepts `legacyApiKey`, not an arbitrary caller-supplied
ownerRef.

The server boundary derives the ownerRef internally with `ownerRefFromApiKey()`.

The raw legacy API key is never:

- persisted
- written to metadata
- logged by the service
- returned
- serialized in errors
- used to call MuAPI

## Claim Model

Table:

`public.dynaxis_owner_ref_claims`

Columns:

- `legacy_owner_ref text primary key`
- `organization_id uuid not null`
- `claimed_by_user_id uuid null`
- `claimed_at timestamptz not null default now()`
- `metadata jsonb not null default '{}'`

Foreign keys:

- `organization_id` references `auth.organization.id` with `ON DELETE RESTRICT`
- `claimed_by_user_id` references `auth.user.id` with `ON DELETE SET NULL`

The organization FK is restrictive so a claimed historical ownerRef does not
silently become claimable by another workspace if an organization is deleted.
The claimant FK is nullable so the claim survives deletion or anonymisation of
the human account that originally performed the claim.

## Uniqueness Rule

One `legacy_owner_ref` may be claimed by one organization.

An organization may claim multiple historical ownerRefs.

Historically, multiple people using the same MuAPI API key produced the same
ownerRef. Therefore that historical ownerRef can belong to only one Dynaxis
workspace. If multiple people require access to that historical data, they must
ultimately be members of the same organization workspace.

Historical data is not duplicated across organizations.

## Authority

Only Better Auth organization members with one of these roles can claim a
legacy ownerRef:

- `owner`
- `admin`

These roles may appear in Better Auth's comma-separated `member.role` field.

The following roles cannot claim:

- `member`
- `viewer`
- non-members

This is a narrow high-impact workspace-policy check, not the full future
Dynaxis RBAC/ABAC permission engine.

## Idempotency

Repeated claim attempts with the same legacy key and same organization return
the same canonical claim.

The service does not rewrite:

- `claimed_by_user_id`
- `claimed_at`
- `metadata`

Those fields record the original claim event.

If the same ownerRef is claimed by a different organization, the service returns
a canonical conflict without revealing the owning organization.

## Personal Workspaces

A personal workspace may claim a historical ownerRef.

Personal workspaces remain single-member. If a historical API key represented
shared/team usage, the correct destination is an organization workspace rather
than a personal workspace.

Claim transfer is not implemented in this phase.

## Immutable Normal Operation

Normal application services do not implement:

- claim transfer
- claim deletion
- claim reassignment
- claim overwrite

Changing historical ownerRef ownership is a high-impact administrative migration
operation and belongs to a future audited exceptional process.

## Preview Key Rejection

The local preview key and `ak_sha256:preview:local` ownerRef are not claimable.

Preview/local development ownership is not a real historical account identity.

## Lookup Seam For 7C.4

Phase 7C.3 adds safe server-side lookup helpers:

- `getLegacyOwnerRefClaim(legacyOwnerRef)`
- `resolveOrganizationForLegacyOwnerRef(legacyOwnerRef)`
- `listLegacyOwnerRefClaimsForOrganization(organizationId)`

These functions accept already-derived ownerRefs for trusted internal lookup and
do not create claims.

The external claim path still requires possession of the legacy API key.

## Explicitly Not Included

Phase 7C.3 does not implement:

- resource `organization_id` columns
- owner_ref rewrites
- backfills
- project membership
- RBAC/ABAC
- AuthContext
- route migration
- public claim endpoint
- public signup
- Dynaxis API keys
- Provider Connections / Secrets
- MuAPI validation calls
- provider network calls
- queues/workers/webhooks

Phase 7C.4 will introduce canonical workspace ownership using this claim table.
