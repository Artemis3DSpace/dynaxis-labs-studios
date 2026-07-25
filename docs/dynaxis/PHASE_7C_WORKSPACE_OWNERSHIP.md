# Phase 7C.4 - Canonical Workspace Ownership

## Status

Phase 7C.4 adds canonical Dynaxis Workspace ownership to the existing root
resource model. Phase 7C remains incomplete.

## Ownership Hierarchy

Better Auth `auth.organization` is the Dynaxis Workspace identity primitive.

Canonical workspace ownership is represented by nullable `organization_id`
columns on workspace-owned root resources.

Historical compatibility ownership remains represented by `owner_ref`.

During Phase 7C the model is dual-mode:

```text
organization_id present
-> canonical workspace owner

organization_id null + claimed owner_ref
-> dynaxis_owner_ref_claims resolves canonical workspace owner

organization_id null + unclaimed owner_ref
-> legacy owner_ref compatibility only
```

## Workspace-Owned Roots

Only these root tables receive `organization_id` in Phase 7C.4:

- `dynaxis_projects`
- `dynaxis_characters`
- `dynaxis_products`
- `dynaxis_brands`
- `dynaxis_design_templates`
- `dynaxis_design_components`
- `dynaxis_design_systems`
- `dynaxis_design_component_sets`

Each column is nullable, references `auth.organization.id`, uses `ON DELETE
RESTRICT`, and has a normal organization index.

## Project-Scoped Inheritance

Project-scoped resources inherit workspace ownership through Project:

```text
Generation -> Project -> organization_id
Job -> Project -> organization_id
Asset -> Project -> organization_id
Campaign -> Project -> organization_id
Composition -> Project -> organization_id
```

Phase 7C.4 intentionally does not copy `organization_id` into those child
tables.

## Revision And Child Inheritance

Reusable root revisions inherit through their parent root:

```text
Character Revision -> Character -> organization_id
Product Revision -> Product -> organization_id
Brand Revision -> Brand -> organization_id
Design Template Revision -> Design Template -> organization_id
Design Component Revision -> Design Component -> organization_id
Design System Revision -> Design System -> organization_id
Component Set Variant -> Component Set -> organization_id
```

Join tables do not transfer ownership. Linking a reusable object to a Project
does not change the reusable object's owning Workspace.

## Nullable Migration Strategy

`organization_id` remains nullable for the Phase 7C transition.

The migration does not:

- remove `owner_ref`
- rewrite historical `owner_ref` values
- make `organization_id` `NOT NULL`
- duplicate ownership into child tables

## OwnerRef Compatibility

`owner_ref` remains the legacy compatibility and provenance partition.

The legacy `x-api-key` path and `ownerRefFromApiKey()` hashing remain
unchanged. Phase 7C.4 does not introduce `x-dynaxis-api-key` or an `org:<uuid>`
ownerRef scheme.

Existing legacy routes continue querying by `owner_ref`. They do not switch to
organization-level visibility until AuthContext and route migration phases.

## Claim-Based Projection

Successful ownerRef claims now project canonical ownership onto historical root
resources:

```text
claimLegacyOwner()
-> dynaxis_owner_ref_claims
-> projectWorkspaceOwnershipForLegacyOwnerRef()
-> nullable root organization_id values
```

Projection updates only rows where:

```sql
owner_ref = legacyOwnerRef
AND organization_id IS NULL
```

It never overwrites non-null `organization_id`.

## Runtime Projection Requirement

The 0012 migration includes safe claim-based backfills for already-claimed
environments. That is not sufficient by itself because fresh deployments may
run 0012 before users create claims.

Therefore runtime projection during `claimLegacyOwner()` is mandatory. Repeating
a same-workspace claim also runs projection so previously unprojected resources
can be repaired without rewriting the original claim event.

## New Legacy Writes

New legacy writes for the eight root resources derive `organization_id` from the
claimed `owner_ref` at the canonical service boundary.

If the ownerRef is claimed, new root rows are dual-stamped:

```text
owner_ref = historical compatibility owner
organization_id = canonical Workspace
```

If the ownerRef is unclaimed, `organization_id` remains null.

Browser callers cannot supply arbitrary `organizationId` overrides in this
phase.

## Ownership Conflict Invariant

If a row has:

```text
owner_ref = claimed ownerRef
organization_id != claim.organization_id
```

the ownership boundary raises `DYNAXIS_WORKSPACE_OWNERSHIP_CONFLICT`.

Projection does not reassign resources from one Workspace to another.

## Not Route Migration

Phase 7C.4 does not expose organization-authenticated product routes.

Existing `withPlatformAuth()`, `requireOwnerFromRequest()`, and `x-api-key`
behavior remain unchanged.

## Not Project Membership

Phase 7C.4 does not create `dynaxis_project_members`.

Workspace membership continues to use Better Auth `member`.

Project membership is Phase 7C.5.

## Next

Phase 7C.5 introduces Project membership on top of this canonical workspace
ownership foundation.
