# Phase 7C.6 - Authorization Vocabulary And Policy Specification

## Status

Phase 7C.6 defines the canonical Dynaxis authorization vocabulary and policy
boundaries. It is specification only. It does not implement the evaluator,
change runtime routes, add database migrations, or complete Phase 7C.

## Security Model

Dynaxis authorization is deny by default.

A request is allowed only when all of the following are true:

- the subject is known and represented by canonical AuthContext input
- the requested permission name is part of this vocabulary
- the request has the required Workspace context
- Project-scoped requests have the required Project context
- the resource belongs to the resolved Workspace or Project inheritance chain
- the relevant Workspace, Project, or resource policy grants the permission
- no explicit invariant or compatibility conflict denies the request

Unknown permissions, missing subjects, inactive sessions, missing Workspace
context, missing Project context, unresolved resources, ownership conflicts, and
legacy compatibility ambiguity are denials.

Provider credentials, model accounts, worker adapters, raw legacy API keys, and
Developer Platform API credentials are never Dynaxis user identity. They may be
inputs to separate connection or execution systems, but they do not grant
permissions in this policy.

## Principal Model

The evaluator consumes principals from the canonical AuthContext contract. The
principal model is intentionally separate from provider or model credentials.

| Principal | Description | May Grant Permissions |
| --- | --- | --- |
| `anonymous` | No authenticated Dynaxis subject. | No. |
| `user` | Better Auth user with a session and optional active Workspace. | Yes, through Workspace and Project membership. |
| `legacy_api_key` | Compatibility principal derived from `x-api-key` by the server boundary. | Yes, only through explicit legacy compatibility paths. |
| `service_account` | Future internal Dynaxis service actor. | Only through explicit service allowlists. |
| `provider_credential` | External model, storage, or provider credential. | No. |
| `worker_adapter` | Execution adapter for agents, jobs, or model providers. | No. |
| `developer_platform_key` | Future external developer API credential. | No in Phase 7C. |

Raw API keys are never evaluator subjects. The legacy compatibility path must
derive `owner_ref` internally using the existing ownerRef hashing boundary and
must not persist, log, echo, or compare raw keys in authorization policy.

## Policy Layers

Authorization is evaluated in layers. Later layers may narrow an earlier grant,
but they must not bypass required context.

| Layer | Owns | Source Of Truth | Required For |
| --- | --- | --- | --- |
| Workspace policy | Workspace membership and workspace administration. | Better Auth `auth.organization`, `auth.member`, and Dynaxis personal Workspace invariants. | Any request that touches Workspace-owned Dynaxis data. |
| Project policy | Project membership and Project administration. | `public.dynaxis_projects` and `public.dynaxis_project_members`. | Project actions and Project-scoped child resources. |
| Resource inheritance | Mapping a concrete resource to Workspace or Project ownership. | Canonical ownership map from Phase 7C.4. | Asset, Generation, Job, Campaign, Composition, Character, Product, Brand, and Design resource access. |
| Compatibility policy | Temporary legacy `owner_ref` access. | Server-derived `owner_ref` and `dynaxis_owner_ref_claims`. | Existing routes that have not migrated to AuthContext. |
| Administrative invariants | Final-owner protections and migration safety checks. | Dynaxis service rules and documented invariants. | Membership mutation, projection, audit, and policy administration. |

Better Auth organization membership is Workspace membership only. It is not
Project membership. A Workspace owner or admin may administer the Workspace, but
Project and child-resource access must still pass the defined Project or
resource policy unless a permission explicitly says it is a Workspace
administrative permission.

## Role Semantics

Workspace roles are exactly:

- `owner`
- `admin`
- `member`
- `viewer`

Project roles are exactly:

- `owner`
- `admin`
- `editor`
- `viewer`

The two role sets are not interchangeable. Workspace `member` does not imply
Project `editor`. Project `owner` does not imply Workspace `owner`.

Personal Workspaces remain single-member Workspaces. Authorization must not
introduce arbitrary sharing of personal Workspace data. Personal Workspace
membership and Project membership operations must preserve the owner-only
sharing invariant defined by the identity, Workspace, and Project membership
foundations.

## Role Permission Matrix

The canonical evaluator should use these role grants unless a resource-specific
invariant denies the request.

Workspace role grants:

| Permission | owner | admin | member | viewer |
| --- | --- | --- | --- | --- |
| `workspace.read` | yes | yes | yes | yes |
| `workspace.update` | yes | yes | no | no |
| `workspace.delete` | yes | no | no | no |
| `workspace.member.read` | yes | yes | yes | no |
| `workspace.member.invite` | yes | yes | no | no |
| `workspace.member.update` | yes | yes | no | no |
| `workspace.member.remove` | yes | yes | no | no |
| `workspace.owner_ref.claim` | yes | yes | no | no |
| `admin.audit.read` | yes | yes | no | no |
| `admin.policy.read` | yes | yes | no | no |
| `admin.policy.update` | yes | no | no | no |
| `admin.migration.project` | yes | no | no | no |
| `admin.system.debug` | no | no | no | no |

Project role grants:

| Permission | owner | admin | editor | viewer |
| --- | --- | --- | --- | --- |
| `project.read` | yes | yes | yes | yes |
| `project.create` | yes | yes | no | no |
| `project.update` | yes | yes | yes | no |
| `project.archive` | yes | yes | no | no |
| `project.delete` | yes | no | no | no |
| `project.member.read` | yes | yes | yes | no |
| `project.member.invite` | yes | yes | no | no |
| `project.member.update` | yes | yes | no | no |
| `project.member.remove` | yes | yes | no | no |
| `asset.read` | yes | yes | yes | yes |
| `asset.create` | yes | yes | yes | no |
| `asset.update` | yes | yes | yes | no |
| `asset.delete` | yes | yes | no | no |
| `generation.read` | yes | yes | yes | yes |
| `generation.create` | yes | yes | yes | no |
| `generation.update` | yes | yes | yes | no |
| `generation.cancel` | yes | yes | yes | no |
| `job.read` | yes | yes | yes | yes |
| `job.create` | yes | yes | yes | no |
| `job.update` | yes | yes | yes | no |
| `job.cancel` | yes | yes | yes | no |
| `composition.read` | yes | yes | yes | yes |
| `composition.create` | yes | yes | yes | no |
| `composition.update` | yes | yes | yes | no |
| `composition.delete` | yes | yes | no | no |
| `campaign.read` | yes | yes | yes | yes |
| `campaign.create` | yes | yes | yes | no |
| `campaign.update` | yes | yes | yes | no |
| `campaign.delete` | yes | yes | no | no |

Reusable creative root grants use Workspace role and resource ownership, not
Project membership, because linking a reusable object to a Project does not
transfer ownership:

| Permission | owner | admin | member | viewer |
| --- | --- | --- | --- | --- |
| `character.read` | yes | yes | yes | yes |
| `character.create` | yes | yes | yes | no |
| `character.update` | yes | yes | yes | no |
| `character.delete` | yes | yes | no | no |
| `product.read` | yes | yes | yes | yes |
| `product.create` | yes | yes | yes | no |
| `product.update` | yes | yes | yes | no |
| `product.delete` | yes | yes | no | no |
| `brand.read` | yes | yes | yes | yes |
| `brand.create` | yes | yes | yes | no |
| `brand.update` | yes | yes | yes | no |
| `brand.delete` | yes | yes | no | no |
| `design_template.read` | yes | yes | yes | yes |
| `design_template.create` | yes | yes | yes | no |
| `design_template.update` | yes | yes | yes | no |
| `design_template.delete` | yes | yes | no | no |
| `design_component.read` | yes | yes | yes | yes |
| `design_component.create` | yes | yes | yes | no |
| `design_component.update` | yes | yes | yes | no |
| `design_component.delete` | yes | yes | no | no |
| `design_system.read` | yes | yes | yes | yes |
| `design_system.create` | yes | yes | yes | no |
| `design_system.update` | yes | yes | yes | no |
| `design_system.delete` | yes | yes | no | no |
| `design_component_set.read` | yes | yes | yes | yes |
| `design_component_set.create` | yes | yes | yes | no |
| `design_component_set.update` | yes | yes | yes | no |
| `design_component_set.delete` | yes | yes | no | no |
| `design.publish` | yes | yes | yes | no |

`admin.system.debug` is intentionally reserved. It must deny unless a future
work package defines a bounded internal service-account grant and audit model.

## Permission Vocabulary

Every permission has an owning domain and expected subject/resource inputs. The
`Resource Context` column names the concrete resource or action input the
evaluator must resolve before granting access.

Workspace permissions:

| Permission | Owning Domain | Subjects | Resource Context | Workspace Context | Project Context | Inheritance Source | Relevant Roles | Default Denial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workspace.read` | workspace | `user`, compatible `legacy_api_key` | Workspace | required | none | `auth.organization` or claim | Workspace owner/admin/member/viewer | missing Workspace |
| `workspace.update` | workspace | `user` | Workspace settings | required | none | `auth.organization` | Workspace owner/admin | personal Workspace invariant violation |
| `workspace.delete` | workspace | `user` | Workspace | required | none | `auth.organization` | Workspace owner | personal Workspace or referenced data conflict |
| `workspace.member.read` | workspace | `user` | Workspace members | required | none | `auth.member` | Workspace owner/admin/member | missing Workspace membership |
| `workspace.member.invite` | workspace | `user` | Workspace invite target | required | none | `auth.member` | Workspace owner/admin | personal Workspace or duplicate member |
| `workspace.member.update` | workspace | `user` | Workspace member role | required | none | `auth.member` | Workspace owner/admin | final owner demotion/removal |
| `workspace.member.remove` | workspace | `user` | Workspace member | required | none | `auth.member` | Workspace owner/admin | final owner removal |
| `workspace.owner_ref.claim` | workspace | `user` | server-derived ownerRef claim | required | none | `dynaxis_owner_ref_claims` | Workspace owner/admin | raw key, preview key, already claimed elsewhere |

Project permissions:

| Permission | Owning Domain | Subjects | Resource Context | Workspace Context | Project Context | Inheritance Source | Relevant Roles | Default Denial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `project.read` | project | `user`, compatible `legacy_api_key` | Project | required | required | Project `organization_id` or claim | Project owner/admin/editor/viewer | unresolved Project |
| `project.create` | project | `user`, compatible `legacy_api_key` | Project create input | required | none | target Workspace | Workspace owner/admin; legacy ownerRef path | missing Workspace create grant |
| `project.update` | project | `user`, compatible `legacy_api_key` | Project | required | required | Project | Project owner/admin/editor | archived or ownership conflict |
| `project.archive` | project | `user`, compatible `legacy_api_key` | Project | required | required | Project | Project owner/admin | default Project invariant where applicable |
| `project.delete` | project | `user` | Project | required | required | Project | Project owner | dependent data or final owner conflict |
| `project.member.read` | project membership | `user` | Project members | required | required | `dynaxis_project_members` | Project owner/admin/editor | non-member or missing Workspace membership |
| `project.member.invite` | project membership | `user` | Project member target | required | required | `dynaxis_project_members` | Project owner/admin | target not Workspace member |
| `project.member.update` | project membership | `user` | Project member role | required | required | `dynaxis_project_members` | Project owner/admin | final Project owner demotion |
| `project.member.remove` | project membership | `user` | Project member | required | required | `dynaxis_project_members` | Project owner/admin | final Project owner removal |

Project-scoped resource permissions:

| Permission | Owning Domain | Subjects | Resource Context | Workspace Context | Project Context | Inheritance Source | Relevant Roles | Default Denial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `asset.read` | asset | `user`, compatible `legacy_api_key` | Asset | required | required | Asset -> Project | Project owner/admin/editor/viewer | Asset/Project mismatch |
| `asset.create` | asset | `user`, compatible `legacy_api_key` | Asset create input | required | required | target Project | Project owner/admin/editor | missing Project write grant |
| `asset.update` | asset | `user`, compatible `legacy_api_key` | Asset | required | required | Asset -> Project | Project owner/admin/editor | Asset/Project mismatch |
| `asset.delete` | asset | `user` | Asset | required | required | Asset -> Project | Project owner/admin | Asset/Project mismatch |
| `generation.read` | generation | `user`, compatible `legacy_api_key` | Generation | required | required | Generation -> Project | Project owner/admin/editor/viewer | Generation/Project mismatch |
| `generation.create` | generation | `user`, compatible `legacy_api_key` | Generation input | required | required | target Project | Project owner/admin/editor | missing Project write grant |
| `generation.update` | generation | `user`, compatible `legacy_api_key` | Generation | required | required | Generation -> Project | Project owner/admin/editor | terminal-state invariant |
| `generation.cancel` | generation | `user`, compatible `legacy_api_key` | Generation | required | required | Generation -> Project | Project owner/admin/editor | terminal-state invariant |
| `job.read` | job | `user`, compatible `legacy_api_key` | Job | required | required | Job -> Project | Project owner/admin/editor/viewer | Job/Project mismatch |
| `job.create` | job | `user`, compatible `legacy_api_key` | Job input | required | required | target Project | Project owner/admin/editor | missing Project write grant |
| `job.update` | job | `user`, compatible `legacy_api_key` | Job | required | required | Job -> Project | Project owner/admin/editor | terminal-state invariant |
| `job.cancel` | job | `user`, compatible `legacy_api_key` | Job | required | required | Job -> Project | Project owner/admin/editor | terminal-state invariant |
| `composition.read` | composition | `user`, compatible `legacy_api_key` | Composition | required | required | Composition -> Project | Project owner/admin/editor/viewer | Composition/Project mismatch |
| `composition.create` | composition | `user`, compatible `legacy_api_key` | Composition input | required | required | target Project | Project owner/admin/editor | missing Project write grant |
| `composition.update` | composition | `user`, compatible `legacy_api_key` | Composition | required | required | Composition -> Project | Project owner/admin/editor | Composition/Project mismatch |
| `composition.delete` | composition | `user` | Composition | required | required | Composition -> Project | Project owner/admin | Composition/Project mismatch |
| `campaign.read` | campaign | `user`, compatible `legacy_api_key` | Campaign | required | required | Campaign -> Project | Project owner/admin/editor/viewer | Campaign/Project mismatch |
| `campaign.create` | campaign | `user`, compatible `legacy_api_key` | Campaign input | required | required | target Project | Project owner/admin/editor | missing Project write grant |
| `campaign.update` | campaign | `user`, compatible `legacy_api_key` | Campaign | required | required | Campaign -> Project | Project owner/admin/editor | Campaign/Project mismatch |
| `campaign.delete` | campaign | `user` | Campaign | required | required | Campaign -> Project | Project owner/admin | Campaign/Project mismatch |

Reusable creative root permissions:

| Permission | Owning Domain | Subjects | Resource Context | Workspace Context | Project Context | Inheritance Source | Relevant Roles | Default Denial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `character.read` | character | `user`, compatible `legacy_api_key` | Character | required | none | Character `organization_id` or claim | Workspace owner/admin/member/viewer | Workspace mismatch |
| `character.create` | character | `user`, compatible `legacy_api_key` | Character input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `character.update` | character | `user`, compatible `legacy_api_key` | Character | required | none | Character | Workspace owner/admin/member | Workspace mismatch |
| `character.delete` | character | `user` | Character | required | none | Character | Workspace owner/admin | Workspace mismatch |
| `product.read` | product | `user`, compatible `legacy_api_key` | Product | required | none | Product `organization_id` or claim | Workspace owner/admin/member/viewer | Workspace mismatch |
| `product.create` | product | `user`, compatible `legacy_api_key` | Product input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `product.update` | product | `user`, compatible `legacy_api_key` | Product | required | none | Product | Workspace owner/admin/member | Workspace mismatch |
| `product.delete` | product | `user` | Product | required | none | Product | Workspace owner/admin | Workspace mismatch |
| `brand.read` | brand | `user`, compatible `legacy_api_key` | Brand | required | none | Brand `organization_id` or claim | Workspace owner/admin/member/viewer | Workspace mismatch |
| `brand.create` | brand | `user`, compatible `legacy_api_key` | Brand input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `brand.update` | brand | `user`, compatible `legacy_api_key` | Brand | required | none | Brand | Workspace owner/admin/member | Workspace mismatch |
| `brand.delete` | brand | `user` | Brand | required | none | Brand | Workspace owner/admin | Workspace mismatch |
| `design_template.read` | design | `user`, compatible `legacy_api_key` | Design Template | required | none | Design Template | Workspace owner/admin/member/viewer | Workspace mismatch |
| `design_template.create` | design | `user`, compatible `legacy_api_key` | Design Template input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `design_template.update` | design | `user`, compatible `legacy_api_key` | Design Template | required | none | Design Template | Workspace owner/admin/member | Workspace mismatch |
| `design_template.delete` | design | `user` | Design Template | required | none | Design Template | Workspace owner/admin | Workspace mismatch |
| `design_component.read` | design | `user`, compatible `legacy_api_key` | Design Component | required | none | Design Component | Workspace owner/admin/member/viewer | Workspace mismatch |
| `design_component.create` | design | `user`, compatible `legacy_api_key` | Design Component input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `design_component.update` | design | `user`, compatible `legacy_api_key` | Design Component | required | none | Design Component | Workspace owner/admin/member | Workspace mismatch |
| `design_component.delete` | design | `user` | Design Component | required | none | Design Component | Workspace owner/admin | Workspace mismatch |
| `design_system.read` | design | `user`, compatible `legacy_api_key` | Design System | required | none | Design System | Workspace owner/admin/member/viewer | Workspace mismatch |
| `design_system.create` | design | `user`, compatible `legacy_api_key` | Design System input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `design_system.update` | design | `user`, compatible `legacy_api_key` | Design System | required | none | Design System | Workspace owner/admin/member | Workspace mismatch |
| `design_system.delete` | design | `user` | Design System | required | none | Design System | Workspace owner/admin | Workspace mismatch |
| `design_component_set.read` | design | `user`, compatible `legacy_api_key` | Design Component Set | required | none | Design Component Set | Workspace owner/admin/member/viewer | Workspace mismatch |
| `design_component_set.create` | design | `user`, compatible `legacy_api_key` | Design Component Set input | required | none | target Workspace | Workspace owner/admin/member | missing Workspace write grant |
| `design_component_set.update` | design | `user`, compatible `legacy_api_key` | Design Component Set | required | none | Design Component Set | Workspace owner/admin/member | Workspace mismatch |
| `design_component_set.delete` | design | `user` | Design Component Set | required | none | Design Component Set | Workspace owner/admin | Workspace mismatch |
| `design.publish` | design | `user`, compatible `legacy_api_key` | Publishable design root or Project-scoped composition | required | maybe | owning Workspace or Project | Workspace member+ or Project editor+ | unresolved ownership path |

Administration permissions:

| Permission | Owning Domain | Subjects | Resource Context | Workspace Context | Project Context | Inheritance Source | Relevant Roles | Default Denial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin.audit.read` | admin | `user` | Workspace audit view | required | none | Workspace | Workspace owner/admin | missing audit context |
| `admin.policy.read` | admin | `user` | Workspace policy view | required | none | Workspace | Workspace owner/admin | missing policy context |
| `admin.policy.update` | admin | `user` | Workspace policy settings | required | none | Workspace | Workspace owner | unsupported policy mutation |
| `admin.migration.project` | admin | `user` | ownership projection or migration action | required | maybe | Workspace plus affected resource | Workspace owner | migration owner conflict |
| `admin.system.debug` | admin | `service_account` | internal diagnostic action | required | maybe | explicit internal allowlist | none by default | no service grant |

## Resource Ownership And Inheritance Map

Workspace-owned roots use their own nullable `organization_id` as the canonical
Workspace owner when present:

- Project
- Character
- Product
- Brand
- Design Template
- Design Component
- Design System
- Design Component Set

If `organization_id` is null and the resource has a claimed `owner_ref`, the
compatibility layer may resolve Workspace ownership through
`dynaxis_owner_ref_claims`. If the resource has a contradictory non-null
`organization_id`, the evaluator must deny with an ownership-conflict reason.

Project-scoped resources inherit authorization through their canonical Project:

- Generation -> Project -> Workspace
- Job -> Project -> Workspace
- Asset -> Project -> Workspace
- Campaign -> Project -> Workspace
- Composition -> Project -> Workspace

Reusable root revisions inherit through their parent root:

- Character Revision -> Character -> Workspace
- Product Revision -> Product -> Workspace
- Brand Revision -> Brand -> Workspace
- Design Template Revision -> Design Template -> Workspace
- Design Component Revision -> Design Component -> Workspace
- Design System Revision -> Design System -> Workspace
- Component Set Variant -> Design Component Set -> Workspace

Link and join tables do not transfer ownership. A Brand linked to a Project is
still owned by the Brand's Workspace. An Asset linked to a Brand still authorizes
through its Project. Evaluators must check both sides of a link operation and
deny if either side is not authorized for the requested action.

## Evaluator Contract For WP-7C-09

WP-7C-09 should implement a pure authorization evaluator over canonical inputs.
The evaluator must not parse request headers, load provider credentials, or
derive raw legacy ownerRefs itself.

Input:

```ts
type AuthorizationInput = {
  authContext: AuthContext;
  permission: DynaxisPermission;
  resource?: {
    type: DynaxisResourceType;
    id?: string;
    organizationId?: string | null;
    projectId?: string | null;
    ownerRef?: string | null;
    status?: string | null;
  };
  action?: {
    targetUserId?: string;
    targetRole?: string;
    legacyOwnerRef?: string;
  };
};
```

Expected AuthContext compatibility:

- `authContext.subject.type` distinguishes anonymous, user, legacy API-key, and
  service-account subjects.
- `authContext.session` represents authenticated Better Auth session state when
  available.
- `authContext.workspace` represents the active or resolved Workspace.
- `authContext.workspace.role` is a Better Auth Workspace role.
- `authContext.project` is present for Project-scoped requests after Project
  resolution.
- `authContext.project.role` is a Dynaxis Project role, not a Workspace role.
- `authContext.legacy.ownerRef` is server-derived compatibility data, never a
  raw API key.
- `authContext.permissions` may contain a projection cache, but the evaluator
  remains authoritative and deny-by-default for unknown names.

Output:

```ts
type AuthorizationResult = {
  allowed: boolean;
  reason: AuthorizationReason;
  permission: DynaxisPermission;
  workspaceId?: string;
  projectId?: string;
  resourceType?: DynaxisResourceType;
  resourceId?: string;
};
```

The evaluator may include extra diagnostic fields for tests, but production
responses must not expose raw API keys, provider secrets, sensitive membership
metadata, or internal stack traces.

## Stable Denial Reasons

WP-7C-09 should export stable machine-readable reason constants. These names are
part of the contract for route migration tests.

| Reason | Meaning |
| --- | --- |
| `DYNAXIS_AUTHZ_ALLOWED` | Request is allowed. |
| `DYNAXIS_AUTHZ_UNKNOWN_PERMISSION` | Permission name is not in the vocabulary. |
| `DYNAXIS_AUTHZ_MISSING_SUBJECT` | No subject is available. |
| `DYNAXIS_AUTHZ_ANONYMOUS_DENIED` | Anonymous principal requested a protected permission. |
| `DYNAXIS_AUTHZ_INACTIVE_SESSION` | User session is missing or inactive for a user-only permission. |
| `DYNAXIS_AUTHZ_MISSING_WORKSPACE` | Required Workspace context is absent. |
| `DYNAXIS_AUTHZ_WORKSPACE_MEMBERSHIP_REQUIRED` | Subject is not a member of the Workspace. |
| `DYNAXIS_AUTHZ_WORKSPACE_ROLE_DENIED` | Workspace role does not grant the permission. |
| `DYNAXIS_AUTHZ_PERSONAL_WORKSPACE_DENIED` | Action would violate personal Workspace invariants. |
| `DYNAXIS_AUTHZ_MISSING_PROJECT` | Required Project context is absent. |
| `DYNAXIS_AUTHZ_PROJECT_MEMBERSHIP_REQUIRED` | Subject is not a Project member. |
| `DYNAXIS_AUTHZ_PROJECT_ROLE_DENIED` | Project role does not grant the permission. |
| `DYNAXIS_AUTHZ_RESOURCE_NOT_FOUND` | Resource cannot be resolved. |
| `DYNAXIS_AUTHZ_RESOURCE_SCOPE_MISMATCH` | Resource does not belong to the resolved Workspace or Project. |
| `DYNAXIS_AUTHZ_OWNERSHIP_CONFLICT` | `owner_ref` claim and canonical `organization_id` conflict. |
| `DYNAXIS_AUTHZ_LEGACY_COMPAT_DENIED` | Legacy principal is outside an explicit compatibility path. |
| `DYNAXIS_AUTHZ_PROVIDER_CREDENTIAL_DENIED` | Provider credential was presented as identity. |
| `DYNAXIS_AUTHZ_FINAL_OWNER_DENIED` | Action would remove or demote the final Workspace or Project owner. |
| `DYNAXIS_AUTHZ_STATE_DENIED` | Resource state makes the action invalid. |
| `DYNAXIS_AUTHZ_SERVICE_ACCOUNT_DENIED` | Service-account allowlist does not grant the permission. |

## Precedence

The evaluator should apply denial precedence in this order so tests and route
responses remain stable:

1. Unknown permission.
2. Missing or anonymous subject.
3. Provider credential or worker adapter presented as identity.
4. Inactive user session.
5. Missing Workspace for Workspace-required permission.
6. Workspace membership or Workspace role denial.
7. Personal Workspace invariant denial.
8. Missing Project for Project-required permission.
9. Project membership or Project role denial.
10. Resource not found.
11. Resource scope mismatch or ownership conflict.
12. Legacy compatibility denial.
13. Final-owner or state invariant denial.
14. Allow.

An implementation may short-circuit before loading expensive resources when an
earlier denial is already determined. It must preserve observable reason
precedence for the data it has already resolved.

## Legacy Compatibility

Legacy compatibility exists only to keep existing `owner_ref` routes operating
while Phase 7C migrates routes to AuthContext.

The compatibility path may allow a `legacy_api_key` principal to access existing
operations whose historical behavior was partitioned by server-derived
`owner_ref`. It must not:

- treat a raw API key as the principal
- grant Workspace membership management
- grant Project membership management
- grant admin policy mutation
- infer user identity from provider credentials
- bypass Project ownership once a route has a Project context
- overwrite canonical `organization_id` values
- resolve the local preview key or `ak_sha256:preview:local` as claimable

When a claimed ownerRef resolves to a Workspace, the evaluator should prefer the
canonical Workspace and Project/resource inheritance map. If canonical ownership
conflicts with the claim, deny with `DYNAXIS_AUTHZ_OWNERSHIP_CONFLICT`.

## Non-Goals

This specification does not define or implement:

- Provider Connections or Secrets runtime policy
- Developer Platform API credentials
- public Project sharing
- invitation flows beyond naming permissions
- route migration
- database migrations
- new Project entities
- Better Auth replacement
- Plugin, Skill, Marketplace, or App Factory authorization implementation
- audit-log persistence
- UI role-management behavior
- service-account creation or lifecycle

## Implementation Requirements For WP-7C-09

WP-7C-09 must:

- export the permission constants from this vocabulary
- export stable authorization reason constants
- implement deny-by-default behavior for unknown permission, missing subject,
  inactive session, missing Workspace, missing Project, unresolved resource, and
  resource ownership conflicts
- treat Better Auth organization membership as Workspace membership only
- consume Project membership as the source of Project role grants
- keep provider credentials, model accounts, and worker adapters outside the
  principal model
- preserve explicit legacy API-key compatibility through server-derived
  `owner_ref` only
- avoid database migrations, route migration, and UI changes unless that Work
  Package explicitly allows them
- include tests for allow/deny decisions, reason precedence, workspace/project
  role separation, Project child inheritance, reusable-root ownership, and
  legacy compatibility denials

WP-7C-09 should not add policy shortcuts for future phases. When a future domain
needs new permissions, it must extend this vocabulary or a successor spec before
runtime grants are introduced.

## Review Checklist

- Every permission name is lower-case, dot-separated, and stable.
- Every permission has an owning domain.
- Every permission declares expected subject and resource inputs.
- Workspace and Project roles remain separate.
- Better Auth membership is used only as Workspace membership.
- Project access uses `dynaxis_project_members` where Project membership is
  required.
- Project-scoped resources inherit through Project.
- Reusable creative roots inherit through their own Workspace ownership.
- Link and join tables do not transfer ownership.
- Unknown permissions and missing context deny by default.
- Provider credentials, model accounts, worker adapters, raw API keys, and
  Developer Platform credentials never become user identity.
- Legacy compatibility is explicit, server-derived, and temporary.
- Final Workspace owner and final Project owner protections remain enforceable.
- No runtime code, schemas, APIs, migrations, or UI are changed by this
  specification.
