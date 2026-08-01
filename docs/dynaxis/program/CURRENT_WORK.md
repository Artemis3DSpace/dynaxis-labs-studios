# Current Dynaxis Work

## Current Programme

Phase 7C complete. **Phase 7D Provider Connections is security-reviewed and complete.** Parallel specification-only planning continues.

### Baseline on main

| Field | Value |
|---|---|
| `origin/main` | `204e5ff051ea7306c4133cbe64f3f7ac561cb239` |
| Test baseline | **664/664 passing** |
| Migrations | `0008` - `0015` (no migration owner active) |
| **Implemented runtime** | **Phases 7C and 7D only** |

### Scaffold waves 1-4 - contracts only, not implementation

Waves 1-4 integrated **thirteen scaffold / domain contract areas** under `lib/dynaxis/**`. They are contract-only — schemas, frozen constants, validators, pure helpers — with **no I/O, no persistence, and no runtime behaviour**.

**No Work Package became `done` because of them.** Persistence, workers, provider use, app generation, publishing, deployment, and storage all remain **not implemented**.

| Wave | `main` after | Tests | Domains |
|---|---|---|---|
| 1 | `39ba975` | 570/570 | jobs (7E), app-factory (8A), composer (8C) |
| 2 | `839590d` | 603/603 | project-graph (7F), capabilities (7G), agents (7I), build-runtime (8B), layout (8D) |
| 3 | `00c17ec` | 638/638 | workspace-intelligence, design-system, template-library |
| 4 | `204e5ff` | 664/664 | assets, publish |

Five of these domains (Waves 3-4) have **no owning Work Package** and their phase documents collide with the authoritative catalogue meanings of 7H, 8E, 8F, 8G, and 8H. Those catalogue meanings are **unchanged**. See **`SCAFFOLD_INVENTORY.md`** for the full inventory (`SD-01` - `SD-13`) and `handoffs/scaffold-waves-reconciliation.md` for the reconciliation record.

### State vocabulary

| State | Meaning | Where |
|---|---|---|
| **implemented runtime** | Work Package `done`, behaviour live | Phases 7C, 7D |
| **scaffold present** | Domain contracts only; runtime not implemented; no schema/migration | `SD-01` - `SD-13` |
| **spec only** | Specification Work Package `ready` or `done`; no code | 7E-01/02/03, 7F-01, 7G-01, 7H-01, 7I-01, 8A-01, 8C-01, 8F-01, 8G-01, 8H-01, 9-01 |
| **requires future work-package ownership** | Scaffold on `main` with no owning Work Package | `SD-09` - `SD-13` |

### Blocked - must not be touched yet

- **`WP-7E-06` ProviderConnection worker use** — blocked by residual risk **R1** (no service-principal allowlist). Enforced in code: `assertWorkerProviderConnectionBlocked()` in `lib/dynaxis/jobs/contracts.js` throws `501` unconditionally.
- **Durable audit persistence** — residual risk **R3**; needs a migration owner.
- **Production KMS** — residual risk **R4**; adapter fails closed.
- **Schema/migrations for any scaffold domain** — only the named persistence Work Package may open one, serialized per `CONFLICT_MATRIX.md`.
- **`SD-09` - `SD-13` runtime** — no owning Work Package exists.

## Completed

- 7C.1
- 7C.2
- 7C.3
- 7C.4 Canonical Workspace Ownership
- 7C.5 Project Membership Schema and Role Model
- WP-7C-06 Project Membership Service Invariants
- WP-7C-07 Project Membership Tests and Fixtures
- WP-7C-08 Authorization Vocabulary and Policy Specification
- WP-7C-09 Authorization Evaluator and Workspace Policy
- WP-7C-10 Project Policy and Resource Inheritance
- WP-7C-11 Authorization Regression Test Suite
- WP-7C-12 Canonical AuthContext Contract
- WP-7C-13 AuthContext Route Helper Integration
- WP-7C-24 Canonical Persistence Access Bridge (migration owner: 0014)
- WP-7C-14 Route Migration: Projects and Assets
- WP-7C-15 Route Migration: Generations Jobs and Lifecycle
- WP-7C-16 Route Migration: Characters Products Brands Campaigns
- WP-7C-17 Route Migration: Design APIs and Mini App Execution
- WP-7C-18 TanStack Query Foundation and Query Keys
- WP-7C-19 Client Session and Workspace Switching
- WP-7C-20 Project Queries and Studio Migration
- WP-7C-21 Identity Signup Provisioning and Recovery Hardening
- WP-7C-22 Session Rate Limit Abuse and Security Tests
- WP-7C-23 Identity Integration Gate
- WP-7D-01 ProviderConnection Contract and Threat Model
- WP-7D-02 Secret Storage and Key Management Architecture
- WP-7D-03 Provider Connection Schema and Migration (migration owner: 0015)
- WP-7D-04 Provider Connection Services and Permissions
- WP-7D-05 MuAPI Credential Migration and Provider Resolver
- WP-7D-06 Connection Health Rotation UI and Audit
- WP-7D-07 Provider Connection Security Review

## In Review

(none)

## In Progress

(none)

Phase 7C.5 is integrated. `WP-7C-05` is complete and its branch and implementation history are preserved on main.

`WP-7C-06` is complete and its branch and implementation history are preserved on main. `WP-7C-07` Project Membership Tests and Fixtures is complete and integrated on main.

Project Membership slice `WP-7C-05` through `WP-7C-07` is complete. Authorization Vocabulary/Policy Specification is complete on `phase-7c/authorization-spec`. Authorization Evaluator + Workspace Policy is complete on `phase-7c/authorization-workspace-policy`. `WP-7C-10` Project Policy and Resource Inheritance is integrated from `phase-7c/project-policy-resource-inheritance`. `WP-7C-11` Authorization Regression Test Suite is integrated from `phase-7c/authorization-regression-review`. `WP-7C-12` Canonical AuthContext Contract is integrated from `phase-7c/auth-context-contract`. `WP-7C-13` AuthContext Route Helper Integration is integrated from `phase-7c/auth-context-route-helper`. `WP-7C-24` Canonical Persistence Access Bridge is integrated from `phase-7c/canonical-persistence-access`. Route migration wave `WP-7C-14` through `WP-7C-17` is integrated on main. `WP-7C-18` TanStack Query Foundation is integrated from `phase-7c/tanstack-query-foundation`. `WP-7C-19` Client Session and Workspace Switching is integrated from `phase-7c/client-session-workspace-switching`. `WP-7C-20` Project Queries and Studio Migration is integrated from `phase-7c/project-queries-studio-migration`. `WP-7C-21` Identity Signup Provisioning and Recovery Hardening is integrated from `phase-7c/identity-signup-provisioning-recovery-hardening`. `WP-7C-22` Session Rate Limit Abuse and Security Tests is integrated from `phase-7c/session-rate-limit-abuse-security-tests`. `WP-7C-23` Identity Integration Gate is integrated from `phase-7c/identity-integration-gate`; Phase 7C identity work is complete.

`WP-7D-03` Provider Connection Schema and Migration is **completed** and integrated from `phase-7d/provider-connection-schema-migration`. Migration `0015` (`0015_phase_7d_3_provider_connections.sql`) is integrated on main, adding `dynaxis_provider_connections` and `dynaxis_provider_secret_envelopes` as storage shape only. No Phase 7D migration owner is active.

`WP-7D-04` Provider Connection Services and Permissions is **completed** and integrated from `phase-7d/provider-connection-services-permissions`. It delivers the server-only ProviderConnection service layer, the seven `provider_connection.*` permission checks, AES-256-GCM secret envelope encryption/decryption with AAD binding, the key-management boundary (production KMS interface that fails closed, environment-only local dev keys, deterministic test keys gated to `NODE_ENV=test`), the server-only unwrap/materialization boundary, fail-closed runtime behavior, and runtime audit logging. It added no schema and no migration.

`WP-7D-05` MuAPI Credential Migration and Provider Resolver is **completed** and integrated from `phase-7d/muapi-credential-migration-provider-resolver`. The Provider Resolver and the MuAPI credential migration path are integrated: MuAPI credential use now routes through the ProviderConnection runtime boundary (`selectProviderConnection` -> `useProviderCredential` -> `service.resolveForUse` -> unwrap -> adapter), with `providerId` pinned and re-asserted after materialization. Provider adapters remain pure — `lib/dynaxis/providers/**` was not modified and imports neither ProviderConnection nor secret internals. Legacy `x-api-key` remains a compatibility principal only: it does not become a ProviderConnection credential and grants no ProviderConnection authority. Selection gates on `provider_connection.read`, so an unauthorized caller cannot expose `secretRef`/`keyRef`. No OAuth, no UI, no schema, and no migration were added.

`WP-7D-06` Connection Health Rotation UI and Audit is **completed** and integrated from `phase-7d/connection-health-rotation-ui-audit`. The connection health surface, the rotation/revoke/delete action boundaries, safe audit visibility, the ProviderConnection API routes under `app/api/dynaxis/provider-connections/**`, and a minimal Studio ProviderConnection panel are all integrated. Every browser/API projection is allowlist-based. The public audit projection strips `secretVersion`, `secretStatus`, and `previousSecretStatus`, while the server-side audit sink remains in-memory and retains those fields for server forensic metadata; no durable audit persistence was added. The Studio client fail-closed forbidden-field guard remains active. No OAuth implementation, no schema, no migration, and no provider adapter changes were made — `lib/dynaxis/providers/**` remains pure and imports neither ProviderConnection nor secret internals.

`WP-7D-07` Provider Connection Security Review is **completed** and integrated from `phase-7d/provider-connection-security-review`. **Phase 7D Provider Connections is security-reviewed and complete.** The 25-item security checklist and 18 negative tests are integrated. Three findings were fixed: the detail-endpoint `FORBIDDEN` vs `NOT_FOUND` enumeration oracle, `assertCanonicalPrincipal` moved to the shared `route-guard.js` helper, and `algorithm` stripped from the public audit projection.

Security posture recorded by the review: provider credentials are **not identity** — they never become Better Auth users, Dynaxis principals, workspace members, Project members, AuthContext subjects, or policy actors, and provider account metadata is never consulted for authorization. Legacy `x-api-key` grants **no** ProviderConnection authority. Service principals remain **fail-closed** at the route guard, the policy evaluator, and the resolver; **`WP-7E` worker dispatch must not use ProviderConnections until an explicit tested service-principal allowlist exists.** Browser redaction is **exception-free, including `algorithm`**: public browser/API/Studio projections expose no `secretRef`, `keyRef`, envelope internals, plaintext, raw credentials, `algorithm`, or key-management state. The Studio fail-closed forbidden-field guard remains active, and provider adapters remain pure. No OAuth implementation, no provider adapter implementation, no schema, and no migration were added. No durable audit sink was added; KMS remains unwired and the production adapter still fails closed until configured.

## Ready Work Packages


- WP-7E-01 Job State Machine Specification
- WP-7E-02 Queue Abstraction and Selection
- WP-7E-03 Job Event Model and Audit Timeline
- WP-7F-01 Project Graph Ontology and Edge Taxonomy
- WP-7G-01 Capability Taxonomy and Model Domain Specification
- WP-7H-01 Identity Profile Domain and Consent Specification
- WP-7I-01 Agent Role and Permission Contract Specification
- WP-8A-01 App IR Specification and Versioning
- WP-8C-01 Composer Sequence Domain and Render Graph Specification
- WP-8F-01 Public API v1 and OpenAPI Contract
- WP-8G-01 Plugin Manifest Package Permissions and Capabilities
- WP-8H-01 Marketplace Package Contract and Publisher Model
- WP-9-01 Supercomputer Planning Contract and Safety Model

Specification-only Work Packages may continue in parallel under their documented path restrictions. `WP-7C-08` does not own a migration.

## Ready Runtime Implementation

(none)

**Phase 7D Provider Connections is security-reviewed and complete.** All seven
packages `WP-7D-01` through `WP-7D-07` are integrated.

## Blocked Runtime Implementation

`WP-7E-04` and `WP-7G-02` may now become eligible **according to their own
dependency rules only** — `WP-7D-07` no longer blocks them, but each has
further dependencies of its own and neither has been started.

**`WP-7E-06` ProviderConnection use remains blocked** until an explicit,
tested service-principal allowlist exists. Service principals are fail-closed
at the route guard, the policy evaluator, and the resolver. This is residual
risk R1 below.

## Phase 7D Residual Risks (recorded, closed as follow-ups)

All eleven were worked through by the WP-7D-07 security review: follow-ups 1,
2, 4, 5, and 6 are **fixed**; 3, 7, 8, 9, 10, and 11 are **accepted residual
risks** (R5, R1, R2, R3, R4, R6) with severity and blockers recorded in
`docs/dynaxis/program/handoffs/wp-7d-07-provider-connection-security-review.md`.

The eleven Phase 7D follow-ups are **closed**: five were fixed by WP-7D-07
(detail-endpoint enumeration oracle, `assertCanonicalPrincipal` shared helper,
`algorithm` stripped from public audit, broader resolver-selection regression
tests, AuthContext documented as trust root) and six were converted into the
recorded residual risks below. They are no longer open follow-ups.

| ID | Residual risk | Severity | Status |
|---|---|---|---|
| R1 | No service-principal allowlist; service principals fail-closed at guard, policy, and resolver | **Medium** | **Blocks `WP-7E-06` ProviderConnection use.** WP-7E must define and test an explicit allowlist first. |
| R2 | `provider_connection.*` vocabulary is Phase-7D-local, not in the canonical registry | Low | Accepted — the canonical evaluator returns `UNKNOWN_PERMISSION` → deny, so the split is fail-closed. |
| R3 | Audit sink is in-memory; events do not survive restart | **Medium** | Accepted — durable audit needs a migration owner. No durable audit sink was added. |
| R4 | Production KMS unwired | **Medium** | Accepted — the adapter fails closed until configured; no silent fallback is possible. |
| R5 | Route handlers not executed in tests (`next/server` unresolvable) | Low | Accepted — covered by source assertions plus direct helper tests. |
| R6 | Legacy `x-api-key` routes un-migrated; repository default-flag write | Low | Accepted — legacy remains a compatibility principal with no ProviderConnection authority. |

## Next Sequential Phase Tasks

1. Phase 7D is complete. `WP-7E-04` and `WP-7G-02` become eligible according to their own remaining dependencies; neither has been started. `WP-7E-06` ProviderConnection use stays blocked on residual risk R1.
