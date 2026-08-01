# Current Dynaxis Work

## Current Programme

Phase 7C complete. Phase 7D ready with parallel specification-only planning.

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

- WP-7D-07 Provider Connection Security Review — **ready, not started**

`WP-7D-07` is the Phase 7D security review gate over `WP-7D-03` through
`WP-7D-06`. It should work through the recorded follow-ups below.

## Blocked Runtime Implementation

(none)

## Phase 7D Follow-Ups (recorded, not addressed)

- `WP-7D-07` should review whether detail endpoint responses should align
  `FORBIDDEN` vs `NOT_FOUND` to reduce enumeration differences.
- `WP-7D-07` should consider moving `assertCanonicalPrincipal` out of a route
  module and into a small shared server helper.
- `WP-7D-07` should add or restore executed route-handler coverage once the
  known `next/server` test environment issue is fixed.
- `WP-7D-07` should make a deliberate keep-or-strip decision on the audit
  property `algorithm`: it is safe and publicly documented, but still resembles
  envelope metadata.
- `WP-7D-07` should add broader resolver-selection regression tests beyond the
  fixed blocker test, covering user-owned foreign explicit id, foreign
  `ownerUserId` default spoof, and null workspace context plus foreign
  `organizationId`.
- `WP-7D-07` should explicitly document AuthContext as the Phase 7C/7D trust
  root.
- Service-principal allowlist remains undefined and fail-closed. WP-7E job and
  worker dispatch must not use ProviderConnections until an explicit allowlist
  exists.
- Canonical `provider_connection.*` permission merge into
  `lib/dynaxis/auth/permissions.js` remains future work.
- Durable audit sink remains future work; the current sink is in-memory.
- KMS wiring remains future work; the production adapter fails closed until
  configured.
- Route migration (`app/api/**`, `lib/dynaxis/api.js`) and the repository
  default-flag write in `importLegacyMuapiCredential` remain future work.

## Next Sequential Phase Tasks

1. Provider Connection Security Review (Phase 7D review gate; `WP-7D-07` ready but not started)
