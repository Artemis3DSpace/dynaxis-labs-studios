# Phase 7C.6 - Authorization Vocabulary And Policy Specification

## Status

Phase 7C.6 defines the canonical Dynaxis authorization vocabulary and policy
boundaries for WP-7C-09. It is specification only.

This document does not implement an evaluator, change runtime routes, add
database migrations, edit runtime schemas, or complete Phase 7C.

## Implemented Identity Contracts

This specification follows the implemented Phase 7C identity model:

- Better Auth `auth.organization` is the Dynaxis Workspace identity primitive.
- Better Auth `auth.member` is the Workspace membership primitive.
- Workspace roles are static Better Auth organization roles:
  `owner`, `admin`, `member`, and `viewer`.
- Dynaxis Project remains `public.dynaxis_projects`.
- Dynaxis Project membership is explicit in `public.dynaxis_project_members`.
- Project roles are `owner`, `admin`, `editor`, and `viewer`.
- Workspace-owned roots carry nullable `organization_id` columns.
- Project-owned children inherit Workspace ownership through their Project.
- Legacy compatibility remains `x-api-key -> ownerRefFromApiKey() -> owner_ref`.
- Legacy owner claims live in `public.dynaxis_owner_ref_claims`.

Workspace membership establishes Workspace authority. Project membership
establishes Project authority. One role system must not be automatically
translated into the other.

## Deny By Default

Dynaxis authorization is deny by default.

An action is allowed only when the evaluator receives a supported principal,
known permission, required Workspace context, required Project context where
applicable, a matching resource ownership chain, and a policy grant from the
correct policy layer.

The following always deny unless a later work package defines an explicit,
audited exception:

- absence of permission
- unknown permission name
- missing principal
- missing Workspace context for Workspace-owned data
- missing Project context for Project-scoped data
- missing Workspace membership
- missing Project membership for Project-scoped permissions
- unresolved legacy ownership
- conflicting `organization_id` and claimed `owner_ref`
- provider credential presented as identity
- model account presented as identity
- worker adapter presented as identity
- raw legacy `x-api-key` presented directly to the evaluator
- raw secret presented as authority
- UI-only visibility without server-side authorization

Server-side authorization is authoritative. UI visibility is never an
authorization boundary.

## Subject Model

The evaluator receives already-normalized subjects from the future canonical
AuthContext. It must not parse request headers, load provider secrets, call
model providers, or derive raw legacy ownerRefs itself.

| Subject Type | Description | Authority Source | May Grant Permissions |
| --- | --- | --- | --- |
| `human` | Better Auth human session principal with `auth.user.id` and session state. | Better Auth session, active or resolved Workspace, `auth.member`, and `dynaxis_project_members`. | Yes. |
| `api-key` | Future Dynaxis Developer API-key principal. | Future Dynaxis API-key registry and scoped grants. | Not in Phase 7C unless a later package defines it. |
| `service` | Internal Dynaxis service principal for trusted server-to-server work. | Explicit internal service allowlist, scope, and audit metadata. | Deny by default; only explicit future grants. |
| `legacy` | Compatibility principal derived by the server from `x-api-key` to `owner_ref`. | Existing ownerRef partition plus optional `dynaxis_owner_ref_claims`. | Only on explicit legacy compatibility paths. |

Provider credentials, model accounts, and worker adapters are not authorization
subjects. A MuAPI, Higgsfield, Kling, Fal, Replicate, storage, or model
credential must never become a user identity.

Raw legacy `x-api-key` grants no automatic new Dynaxis permissions. It is a
compatibility input that must be converted by the trusted server boundary into a
legacy principal containing only the derived `owner_ref`.

## Policy Layers

The evaluator has three primary policy layers. They are separate by design.

| Layer | Source Of Truth | Governs |
| --- | --- | --- |
| Workspace policy | Better Auth `auth.organization`, `auth.member`, static Workspace roles, personal Workspace invariants. | Workspace metadata, Workspace membership, billing, settings, audit views, Workspace-owned roots, and Workspace governance. |
| Project policy | `public.dynaxis_projects` and explicit `public.dynaxis_project_members`. | Project records, Project membership, and Project-owned child resources. |
| Resource inheritance | Phase 7C ownership map and resource service contracts. | Assets, Generations, Jobs, Designs, Compositions, Campaigns, and other Project-owned children. |

Compatibility policy is a temporary bridge around server-derived `owner_ref`.
It may resolve historical access for legacy routes, but it is not a fourth role
table and must not bypass canonical Workspace or Project ownership when that
ownership is known.

## Role Boundaries

Workspace roles:

| Role | Eligible Workspace Authority |
| --- | --- |
| `owner` | Full Workspace administration, Workspace membership administration, billing management, settings management, legacy ownerRef claim, Workspace transfer, and Workspace-owned root administration. Must preserve final-owner and personal Workspace invariants. |
| `admin` | Workspace administration except owner-only transfer/destructive governance. Can invite/update/remove non-final members, manage settings, read audit, and claim legacy ownerRefs. |
| `member` | Read Workspace context and create/update ordinary Workspace-owned creative roots where the permission grants it. Cannot administer Workspace membership, billing, ownership, or governance. |
| `viewer` | Read-only Workspace access where the permission grants it. Cannot create, update, delete, invite, transfer, or manage settings. |

Project roles:

| Role | Eligible Project Authority |
| --- | --- |
| `owner` | Full Project administration, Project membership administration, Project transfer, Project delete, and Project-owned child-resource administration. Must preserve final Project owner invariants. |
| `admin` | Project administration and Project member management except owner-only destructive/transfer actions. |
| `editor` | Read and modify Project content and Project-owned child resources. Cannot administer Project membership, delete/transfer Project, or remove Project members. |
| `viewer` | Read-only Project and Project-owned child-resource access. |

Workspace `owner` or `admin` does not automatically become Project `owner` or
`admin`. Project access remains explicit through `dynaxis_project_members`
where the Phase 7C membership model requires it.

## Permission Vocabulary

Every permission below defines its owning domain, subject, resource, required
context, inheritance source, and default deny behavior.

The owning domain is the section name for single-domain tables. In mixed tables,
the owning domain is the permission prefix before the first dot, such as
`character`, `composition`, `settings`, or `audit`.

### Workspace

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `workspace.read` | `human`, explicit `legacy` compatibility | Workspace | Workspace | `auth.organization`, `auth.member`, or claimed ownerRef compatibility | owner/admin/member/viewer | no Workspace or no membership |
| `workspace.update` | `human` | Workspace metadata | Workspace | `auth.organization` | owner/admin | no membership or insufficient Workspace role |
| `workspace.members.read` | `human` | Workspace member list | Workspace | `auth.member` | owner/admin/member | no membership or insufficient Workspace role |
| `workspace.members.invite` | `human` | Workspace invitation target | Workspace | `auth.member`, personal Workspace protections | owner/admin | personal Workspace, no membership, or insufficient Workspace role |
| `workspace.members.update` | `human` | Workspace member role | Workspace | `auth.member`, final-owner invariant | owner/admin | final owner change or insufficient Workspace role |
| `workspace.members.remove` | `human` | Workspace member | Workspace | `auth.member`, final-owner invariant | owner/admin | final owner removal or insufficient Workspace role |
| `workspace.billing.read` | `human` | Workspace billing account | Workspace | future billing ownership rooted in Workspace | owner/admin | no billing context or insufficient Workspace role |
| `workspace.billing.manage` | `human` | Workspace billing settings | Workspace | future billing ownership rooted in Workspace | owner | no billing context or insufficient Workspace role |
| `workspace.transfer` | `human` | Workspace ownership transfer | Workspace | `auth.organization`, `auth.member`, final-owner invariant | owner | target not eligible, personal invariant, or insufficient Workspace role |

### Project

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `project.read` | `human`, explicit `legacy` compatibility | Project | Workspace and Project | `dynaxis_projects`, `dynaxis_project_members` | owner/admin/editor/viewer | no Project membership or unresolved ownership |
| `project.create` | `human`, explicit `legacy` compatibility | Project create input | Workspace | target Workspace | Workspace owner/admin; legacy compatibility only on legacy create paths | no Workspace membership or insufficient Workspace role |
| `project.update` | `human`, explicit `legacy` compatibility | Project | Workspace and Project | `dynaxis_project_members` | owner/admin/editor | no Project membership or insufficient Project role |
| `project.archive` | `human`, explicit `legacy` compatibility | Project | Workspace and Project | `dynaxis_project_members` | owner/admin | no Project membership or insufficient Project role |
| `project.delete` | `human` | Project | Workspace and Project | `dynaxis_project_members`, dependency/final-owner invariants | owner | no Project membership, insufficient Project role, or dependent data invariant |
| `project.members.read` | `human` | Project member list | Workspace and Project | `dynaxis_project_members` | owner/admin/editor | no Project membership or insufficient Project role |
| `project.members.add` | `human` | Workspace member being added to Project | Workspace and Project | `dynaxis_project_members`, `auth.member` FK | owner/admin | target not Workspace member or insufficient Project role |
| `project.members.update` | `human` | Project member role | Workspace and Project | `dynaxis_project_members`, final Project owner invariant | owner/admin | final owner change or insufficient Project role |
| `project.members.remove` | `human` | Project member | Workspace and Project | `dynaxis_project_members`, final Project owner invariant | owner/admin | final owner removal or insufficient Project role |
| `project.transfer` | `human` | Project ownership transfer | Workspace and Project | `dynaxis_project_members`, canonical Project Workspace | owner | unsupported transfer, target not eligible, or insufficient Project role |

### Asset

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `asset.read` | `human`, explicit `legacy` compatibility | Asset | Workspace and Project | Asset -> Project -> Workspace | Project owner/admin/editor/viewer | Asset/Project mismatch or no Project membership |
| `asset.create` | `human`, explicit `legacy` compatibility | Asset create input | Workspace and Project | target Project | Project owner/admin/editor | no Project membership or insufficient Project role |
| `asset.update` | `human`, explicit `legacy` compatibility | Asset | Workspace and Project | Asset -> Project -> Workspace | Project owner/admin/editor | Asset/Project mismatch or insufficient Project role |
| `asset.delete` | `human` | Asset | Workspace and Project | Asset -> Project -> Workspace | Project owner/admin | Asset/Project mismatch or insufficient Project role |

### Generation

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `generation.read` | `human`, explicit `legacy` compatibility | Generation | Workspace and Project | Generation -> Project -> Workspace | Project owner/admin/editor/viewer | Generation/Project mismatch or no Project membership |
| `generation.create` | `human`, explicit `legacy` compatibility | Generation request | Workspace and Project | target Project | Project owner/admin/editor | no Project membership or insufficient Project role |
| `generation.cancel` | `human`, explicit `legacy` compatibility | Generation | Workspace and Project | Generation -> Project -> Workspace | Project owner/admin/editor | terminal-state invariant or insufficient Project role |
| `generation.retry` | `human`, explicit `legacy` compatibility | Generation retry request | Workspace and Project | Generation -> Project -> Workspace | Project owner/admin/editor | invalid retry state or insufficient Project role |

### Job

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `job.read` | `human`, explicit `legacy` compatibility | Job | Workspace and Project | Job -> Project -> Workspace | Project owner/admin/editor/viewer | Job/Project mismatch or no Project membership |
| `job.create` | `human`, explicit `legacy` compatibility | Job create input | Workspace and Project | target Project | Project owner/admin/editor | no Project membership or insufficient Project role |
| `job.cancel` | `human`, explicit `legacy` compatibility | Job | Workspace and Project | Job -> Project -> Workspace | Project owner/admin/editor | terminal-state invariant or insufficient Project role |
| `job.retry` | `human`, explicit `legacy` compatibility | Job retry request | Workspace and Project | Job -> Project -> Workspace | Project owner/admin/editor | invalid retry state or insufficient Project role |

### Design

The `design.*` permissions apply to design/composition work surfaces. Concrete
Workspace-owned design roots also have resource-specific permissions below so
WP-7C-09 does not have to invent names for implemented tables.

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `design.read` | `human`, explicit `legacy` compatibility | Design surface, Composition, Design Template, Component, System, or Component Set | Workspace; Project when Project-scoped | owning Workspace or Project | Workspace owner/admin/member/viewer or Project owner/admin/editor/viewer | unresolved ownership or no membership |
| `design.create` | `human`, explicit `legacy` compatibility | Design create input | Workspace; Project when Project-scoped | target Workspace or Project | Workspace owner/admin/member or Project owner/admin/editor | insufficient Workspace or Project role |
| `design.update` | `human`, explicit `legacy` compatibility | Design resource | Workspace; Project when Project-scoped | owning Workspace or Project | Workspace owner/admin/member or Project owner/admin/editor | resource mismatch or insufficient role |
| `design.delete` | `human` | Design resource | Workspace; Project when Project-scoped | owning Workspace or Project | Workspace owner/admin or Project owner/admin | resource mismatch or insufficient role |
| `design.publish` | `human`, explicit `legacy` compatibility | Publishable design resource | Workspace; Project when Project-scoped | owning Workspace or Project | Workspace owner/admin/member or Project owner/admin/editor | invalid publish state or insufficient role |

Concrete creative-domain permissions:

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `character.read` | `human`, explicit `legacy` compatibility | Character | Workspace | Character `organization_id` or claimed ownerRef | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `character.create` | `human`, explicit `legacy` compatibility | Character input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `character.update` | `human`, explicit `legacy` compatibility | Character | Workspace | Character -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `character.delete` | `human` | Character | Workspace | Character -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `product.read` | `human`, explicit `legacy` compatibility | Product | Workspace | Product `organization_id` or claimed ownerRef | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `product.create` | `human`, explicit `legacy` compatibility | Product input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `product.update` | `human`, explicit `legacy` compatibility | Product | Workspace | Product -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `product.delete` | `human` | Product | Workspace | Product -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `brand.read` | `human`, explicit `legacy` compatibility | Brand | Workspace | Brand `organization_id` or claimed ownerRef | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `brand.create` | `human`, explicit `legacy` compatibility | Brand input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `brand.update` | `human`, explicit `legacy` compatibility | Brand | Workspace | Brand -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `brand.delete` | `human` | Brand | Workspace | Brand -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `campaign.read` | `human`, explicit `legacy` compatibility | Campaign | Workspace and Project | Campaign -> Project -> Workspace | Project owner/admin/editor/viewer | Campaign/Project mismatch or no Project membership |
| `campaign.create` | `human`, explicit `legacy` compatibility | Campaign input | Workspace and Project | target Project | Project owner/admin/editor | insufficient Project role |
| `campaign.update` | `human`, explicit `legacy` compatibility | Campaign | Workspace and Project | Campaign -> Project -> Workspace | Project owner/admin/editor | Campaign/Project mismatch or insufficient Project role |
| `campaign.delete` | `human` | Campaign | Workspace and Project | Campaign -> Project -> Workspace | Project owner/admin | Campaign/Project mismatch or insufficient Project role |
| `composition.read` | `human`, explicit `legacy` compatibility | Composition | Workspace and Project | Composition -> Project -> Workspace | Project owner/admin/editor/viewer | Composition/Project mismatch or no Project membership |
| `composition.create` | `human`, explicit `legacy` compatibility | Composition input | Workspace and Project | target Project | Project owner/admin/editor | insufficient Project role |
| `composition.update` | `human`, explicit `legacy` compatibility | Composition | Workspace and Project | Composition -> Project -> Workspace | Project owner/admin/editor | Composition/Project mismatch or insufficient Project role |
| `composition.delete` | `human` | Composition | Workspace and Project | Composition -> Project -> Workspace | Project owner/admin | Composition/Project mismatch or insufficient Project role |
| `design_template.read` | `human`, explicit `legacy` compatibility | Design Template | Workspace | Design Template -> Workspace | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `design_template.create` | `human`, explicit `legacy` compatibility | Design Template input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `design_template.update` | `human`, explicit `legacy` compatibility | Design Template | Workspace | Design Template -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `design_template.delete` | `human` | Design Template | Workspace | Design Template -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `design_component.read` | `human`, explicit `legacy` compatibility | Design Component | Workspace | Design Component -> Workspace | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `design_component.create` | `human`, explicit `legacy` compatibility | Design Component input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `design_component.update` | `human`, explicit `legacy` compatibility | Design Component | Workspace | Design Component -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `design_component.delete` | `human` | Design Component | Workspace | Design Component -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `design_system.read` | `human`, explicit `legacy` compatibility | Design System | Workspace | Design System -> Workspace | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `design_system.create` | `human`, explicit `legacy` compatibility | Design System input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `design_system.update` | `human`, explicit `legacy` compatibility | Design System | Workspace | Design System -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `design_system.delete` | `human` | Design System | Workspace | Design System -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |
| `design_component_set.read` | `human`, explicit `legacy` compatibility | Design Component Set | Workspace | Design Component Set -> Workspace | Workspace owner/admin/member/viewer | Workspace mismatch or unresolved legacy ownership |
| `design_component_set.create` | `human`, explicit `legacy` compatibility | Design Component Set input | Workspace | target Workspace | Workspace owner/admin/member | insufficient Workspace role |
| `design_component_set.update` | `human`, explicit `legacy` compatibility | Design Component Set | Workspace | Design Component Set -> Workspace | Workspace owner/admin/member | Workspace mismatch or insufficient Workspace role |
| `design_component_set.delete` | `human` | Design Component Set | Workspace | Design Component Set -> Workspace | Workspace owner/admin | Workspace mismatch or insufficient Workspace role |

### Admin And Governance

| Permission | Subject | Resource | Required Context | Inheritance Source | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- | --- |
| `audit.read` | `human` | Workspace audit view | Workspace | Workspace | Workspace owner/admin | no Workspace membership or insufficient Workspace role |
| `settings.read` | `human` | Workspace or Project settings | Workspace; Project when Project-scoped | Workspace or Project | Workspace owner/admin/member/viewer for Workspace settings; Project owner/admin/editor/viewer for Project settings | missing context or membership |
| `settings.manage` | `human` | Workspace or Project settings | Workspace; Project when Project-scoped | Workspace or Project | Workspace owner/admin for Workspace settings; Project owner/admin for Project settings | missing context or insufficient role |
| `workspace.transfer` | `human` | Workspace transfer | Workspace | Workspace | Workspace owner | unsupported transfer or insufficient Workspace role |
| `project.transfer` | `human` | Project transfer | Workspace and Project | Project | Project owner | unsupported transfer or insufficient Project role |

`workspace.transfer` and `project.transfer` appear in their functional domains
and in governance because transfer is both a domain action and a governance
action. The permission string is single and canonical.

## Resource Ownership And Inheritance

Workspace-owned roots:

- Project
- Character
- Product
- Brand
- Design Template
- Design Component
- Design System
- Design Component Set

These roots authorize through their own `organization_id` when present. If
`organization_id` is null and `owner_ref` has a claim, compatibility may resolve
the Workspace through `dynaxis_owner_ref_claims`. If both are present and
conflict, authorization denies with `OWNERSHIP_CONFLICT`.

Project-owned children:

- Asset -> Project -> Workspace
- Generation -> Project -> Workspace
- Job -> Project -> Workspace
- Campaign -> Project -> Workspace
- Composition -> Project -> Workspace
- Project-scoped Character use -> Project -> Workspace for the Project-scoped
  operation, while the reusable Character root remains Workspace-owned
- future App Factory project artifacts -> Project -> Workspace unless a later
  explicit resource policy overrides this

Reusable revisions inherit through their parent root:

- Character Revision -> Character -> Workspace
- Product Revision -> Product -> Workspace
- Brand Revision -> Brand -> Workspace
- Design Template Revision -> Design Template -> Workspace
- Design Component Revision -> Design Component -> Workspace
- Design System Revision -> Design System -> Workspace
- Component Set Variant -> Design Component Set -> Workspace

Globally registered capabilities are not owned by Workspaces or Projects by
default:

- provider capability registry entries
- mini-app capability registry entries
- model capability declarations
- plugin, skill, and marketplace registry definitions
- App Factory capability templates before instantiation into a Project

Using a globally registered capability against Workspace or Project data still
requires authorization on the affected Workspace, Project, or resource.

Link and join tables do not transfer ownership. Linking a Brand, Character,
Product, Design Template, Component, System, or Component Set to a Project does
not change that reusable root's Workspace owner. Link operations must authorize
both sides of the relationship and deny if either side is outside the caller's
authority.

## Evaluator Contract For WP-7C-09

WP-7C-09 should implement a pure evaluator over normalized canonical inputs.
The evaluator must not implement route guards, parse raw headers, load provider
credentials, call provider APIs, or mutate persistence.

Input:

```ts
type AuthorizationInput = {
  principal: {
    type: 'human' | 'api-key' | 'service' | 'legacy';
    subjectId?: string;
    userId?: string;
    serviceId?: string;
    apiKeyId?: string;
    legacyOwnerRef?: string;
  } | null;
  workspace: {
    organizationId: string;
    role?: 'owner' | 'admin' | 'member' | 'viewer';
    isMember?: boolean;
    isPersonal?: boolean;
  } | null;
  project?: {
    projectId: string;
    organizationId: string | null;
    role?: 'owner' | 'admin' | 'editor' | 'viewer';
    isMember?: boolean;
    ownerRef?: string | null;
  } | null;
  resource?: {
    type: DynaxisResourceType;
    id?: string;
    organizationId?: string | null;
    projectId?: string | null;
    ownerRef?: string | null;
    status?: string | null;
  } | null;
  permission: DynaxisPermission;
};
```

Output:

```ts
type AuthorizationDecision = {
  allowed: boolean;
  reason: AuthorizationReason;
  matchedPolicy?: 'workspace' | 'project' | 'resource-inheritance' | 'legacy-compatibility' | 'explicit-deny';
  permission: DynaxisPermission;
  workspaceId?: string;
  projectId?: string;
  resourceType?: DynaxisResourceType;
  resourceId?: string;
};
```

Production responses must not expose raw API keys, provider secrets, raw
connection credentials, sensitive membership metadata, or internal stack traces.

## Stable Decision Reasons

WP-7C-09 must export these stable reason constants exactly:

| Reason | Meaning |
| --- | --- |
| `ALLOW` | Request is allowed. |
| `NO_PRINCIPAL` | No supported principal is present. |
| `NO_WORKSPACE` | Required Workspace context is missing. |
| `NOT_WORKSPACE_MEMBER` | Principal is not a member of the Workspace. |
| `INSUFFICIENT_WORKSPACE_ROLE` | Workspace role does not grant the requested permission. |
| `NOT_PROJECT_MEMBER` | Principal is not an explicit member of the Project. |
| `INSUFFICIENT_PROJECT_ROLE` | Project role does not grant the requested permission. |
| `RESOURCE_SCOPE_MISMATCH` | Resource does not belong to the resolved Workspace or Project chain. |
| `LEGACY_OWNERSHIP_UNRESOLVED` | Legacy `owner_ref` could not be resolved to compatible authority. |
| `OWNERSHIP_CONFLICT` | Canonical `organization_id` conflicts with claimed legacy ownerRef. |
| `UNSUPPORTED_PRINCIPAL` | Principal type is unsupported for the permission. |
| `EXPLICIT_DENY` | A policy, invariant, state rule, or final-owner protection explicitly denies. |

Unknown permission names are `EXPLICIT_DENY` unless WP-7C-09 adds a narrower
diagnostic reason without changing the public contract above.

## Evaluation Precedence

Stable evaluator precedence:

1. Permission not in the canonical vocabulary -> `EXPLICIT_DENY`.
2. Missing principal -> `NO_PRINCIPAL`.
3. Provider credential, model account, worker adapter, or unsupported subject
   presented as authority -> `UNSUPPORTED_PRINCIPAL`.
4. Permission requires Workspace and Workspace context is missing ->
   `NO_WORKSPACE`.
5. Permission requires Workspace membership and it is absent ->
   `NOT_WORKSPACE_MEMBER`.
6. Workspace role is insufficient -> `INSUFFICIENT_WORKSPACE_ROLE`.
7. Permission requires Project membership and it is absent ->
   `NOT_PROJECT_MEMBER`.
8. Project role is insufficient -> `INSUFFICIENT_PROJECT_ROLE`.
9. Legacy ownership cannot be resolved -> `LEGACY_OWNERSHIP_UNRESOLVED`.
10. Canonical ownership conflicts -> `OWNERSHIP_CONFLICT`.
11. Resource is outside the resolved Workspace or Project chain ->
    `RESOURCE_SCOPE_MISMATCH`.
12. Final-owner, personal Workspace, unsupported transfer, invalid state, or
    explicit service allowlist failure -> `EXPLICIT_DENY`.
13. Matching policy grant with no denial -> `ALLOW`.

The evaluator may short-circuit before expensive resource loading when an
earlier denial is already known. It must preserve observable reason precedence
for data it has resolved.

## Security Requirements

- Deny by default.
- Use least privilege.
- Do not allow provider credential authority.
- Do not allow raw secret authority.
- Do not convert Workspace roles into Project roles.
- Do not convert Project roles into Workspace roles.
- Require canonical persisted ownership for canonical authorization.
- Do not let legacy compatibility bypass canonical authorization.
- Treat unresolved legacy ownership as denial.
- Treat conflicting ownership state as denial.
- Keep server-side enforcement authoritative.
- Treat UI visibility only as presentation, never authorization.

## Non-Goals

This specification explicitly excludes:

- Provider Connections / Secrets authorization implementation
- Dynaxis Developer API credentials implementation
- Marketplace publisher policy implementation
- billing implementation
- route guards
- AuthContext implementation
- UI permission controls
- database migrations
- runtime schemas
- production APIs
- Better Auth replacement
- another Project entity
- service-account lifecycle
- audit-log persistence

## Review Checklist

- Every permission has an owning domain through its vocabulary section.
- Every permission defines subject and resource inputs.
- Every permission defines required Workspace and/or Project context.
- Every permission defines an inheritance source.
- Every permission states default deny behavior.
- Workspace and Project roles remain distinct.
- Better Auth `auth.member` is only Workspace membership.
- Dynaxis Project membership remains explicit in `dynaxis_project_members`.
- Project-owned resources inherit through Project.
- Workspace-owned roots inherit through their own `organization_id` or claimed
  ownerRef compatibility.
- Globally registered capabilities are not treated as Workspace or Project data
  until instantiated or used against owned resources.
- Deny by default is explicit.
- Provider credentials grant no identity or authorization.
- Raw legacy API keys grant no new automatic permissions.
- Evaluator input and output contracts are defined.
- Stable decision reasons are defined.
- No runtime implementation, schema, production API, migration, or UI change is
  part of this specification.
