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

## In Review

(none)

## In Progress

(none)

Phase 7C.5 is integrated. `WP-7C-05` is complete and its branch and implementation history are preserved on main.

`WP-7C-06` is complete and its branch and implementation history are preserved on main. `WP-7C-07` Project Membership Tests and Fixtures is complete and integrated on main.

Project Membership slice `WP-7C-05` through `WP-7C-07` is complete. Authorization Vocabulary/Policy Specification is complete on `phase-7c/authorization-spec`. Authorization Evaluator + Workspace Policy is complete on `phase-7c/authorization-workspace-policy`. `WP-7C-10` Project Policy and Resource Inheritance is integrated from `phase-7c/project-policy-resource-inheritance`. `WP-7C-11` Authorization Regression Test Suite is integrated from `phase-7c/authorization-regression-review`. `WP-7C-12` Canonical AuthContext Contract is integrated from `phase-7c/auth-context-contract`. `WP-7C-13` AuthContext Route Helper Integration is integrated from `phase-7c/auth-context-route-helper`. `WP-7C-24` Canonical Persistence Access Bridge is integrated from `phase-7c/canonical-persistence-access`. Route migration wave `WP-7C-14` through `WP-7C-17` is integrated on main. `WP-7C-18` TanStack Query Foundation is integrated from `phase-7c/tanstack-query-foundation`. `WP-7C-19` Client Session and Workspace Switching is integrated from `phase-7c/client-session-workspace-switching`. `WP-7C-20` Project Queries and Studio Migration is integrated from `phase-7c/project-queries-studio-migration`. `WP-7C-21` Identity Signup Provisioning and Recovery Hardening is integrated from `phase-7c/identity-signup-provisioning-recovery-hardening`. `WP-7C-22` Session Rate Limit Abuse and Security Tests is integrated from `phase-7c/session-rate-limit-abuse-security-tests`. `WP-7C-23` Identity Integration Gate is integrated from `phase-7c/identity-integration-gate`; Phase 7C identity work is complete.

`WP-7D-03` Provider Connection Schema and Migration is **completed** and integrated from `phase-7d/provider-connection-schema-migration`. Migration `0015` (`0015_phase_7d_3_provider_connections.sql`) is integrated on main, adding `dynaxis_provider_connections` and `dynaxis_provider_secret_envelopes` as storage shape only. No Phase 7D migration owner is active.

`WP-7D-04` Provider Connection Services and Permissions is **completed** and integrated from `phase-7d/provider-connection-services-permissions`. It delivers the server-only ProviderConnection service layer, the seven `provider_connection.*` permission checks, AES-256-GCM secret envelope encryption/decryption with AAD binding, the key-management boundary (production KMS interface that fails closed, environment-only local dev keys, deterministic test keys gated to `NODE_ENV=test`), the server-only unwrap/materialization boundary, fail-closed runtime behavior, and runtime audit logging. It added no schema and no migration.

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

- WP-7D-05 MuAPI Credential Migration and Provider Resolver — **ready, not started**

`WP-7D-05` may migrate MuAPI credential behavior into ProviderConnection now
that `WP-7D-04` is integrated. It must preserve the WP-7D-02 secret storage
architecture and must not weaken existing credential security. Legacy
`x-api-key` remains a server compatibility principal only: it is not a
ProviderConnection credential and grants no ProviderConnection authority.

## Blocked Runtime Implementation

`WP-7D-06` remains backlog until `WP-7D-04` and `WP-7D-05` are integrated. `WP-7D-07` remains backlog until `WP-7D-03` through `WP-7D-06` are integrated.

## Next Sequential Phase Tasks

1. MuAPI Credential Migration and Provider Resolver (Phase 7D implementation; `WP-7D-05` ready but not started)
