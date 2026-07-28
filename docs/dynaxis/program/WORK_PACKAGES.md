# Dynaxis Work Packages

This is the master index for the remaining Dynaxis roadmap Work Package catalogue after the architecture-quality correction pass.

## Phase 7C - Identity / Organizations / Permissions

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7C-04 | 7C | Canonical Workspace Ownership Tracking | implementation | codex | done | - | yes |
| WP-7C-05 | 7C | Project Membership Schema and Role Model | implementation | codex | done | WP-7C-04 | yes |
| WP-7C-06 | 7C | Project Membership Service Invariants | implementation | codex | done | WP-7C-05 | no |
| WP-7C-07 | 7C | Project Membership Tests and Fixtures | review | codex | done | WP-7C-05, WP-7C-06 | no |
| WP-7C-08 | 7C | Authorization Vocabulary and Policy Specification | specification | codex | done | WP-7C-04 | no |
| WP-7C-09 | 7C | Authorization Evaluator and Workspace Policy | implementation | codex | done | WP-7C-08 | no |
| WP-7C-10 | 7C | Project Policy and Resource Inheritance | implementation | codex | done | WP-7C-06, WP-7C-09 | no |
| WP-7C-11 | 7C | Authorization Regression Test Suite | review | codex | ready | WP-7C-09, WP-7C-10 | no |
| WP-7C-12 | 7C | Canonical AuthContext Contract | implementation | claude | backlog | WP-7C-10 | no |
| WP-7C-13 | 7C | AuthContext Route Helper Integration | implementation | codex | backlog | WP-7C-12 | no |
| WP-7C-14 | 7C | Route Migration: Projects and Assets | implementation | codex | backlog | WP-7C-13 | no |
| WP-7C-15 | 7C | Route Migration: Generations Jobs and Lifecycle | implementation | codex | backlog | WP-7C-10, WP-7C-13 | no |
| WP-7C-16 | 7C | Route Migration: Characters Products Brands Campaigns | implementation | codex | backlog | WP-7C-13 | no |
| WP-7C-17 | 7C | Route Migration: Design APIs and Mini App Execution | implementation | codex | backlog | WP-7C-13 | no |
| WP-7C-18 | 7C | TanStack Query Foundation and Query Keys | implementation | cursor | backlog | WP-7C-12 | no |
| WP-7C-19 | 7C | Client Session and Workspace Switching | implementation | cursor | backlog | WP-7C-12, WP-7C-18 | no |
| WP-7C-20 | 7C | Project Queries and Studio Migration | implementation | cursor | backlog | WP-7C-14, WP-7C-19 | no |
| WP-7C-21 | 7C | Identity Signup Provisioning and Recovery Hardening | implementation | claude | backlog | WP-7C-12, WP-7C-20 | no |
| WP-7C-22 | 7C | Session Rate Limit Abuse and Security Tests | review | claude | backlog | WP-7C-11, WP-7C-21 | no |
| WP-7C-23 | 7C | Identity Integration Gate | integration | codex | backlog | WP-7C-07, WP-7C-11, WP-7C-14, WP-7C-15, WP-7C-16, WP-7C-17, WP-7C-20, WP-7C-22 | no |

## Phase 7D - Provider Connections / Secrets

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7D-01 | 7D | ProviderConnection Contract and Threat Model | specification | claude | ready | - | no |
| WP-7D-02 | 7D | Secret Storage and Key Management Architecture | specification | claude | ready | WP-7D-01 | no |
| WP-7D-03 | 7D | Provider Connection Schema and Migration | implementation | codex | backlog | WP-7C-23, WP-7D-02 | yes |
| WP-7D-04 | 7D | Provider Connection Services and Permissions | implementation | codex | backlog | WP-7D-03 | no |
| WP-7D-05 | 7D | MuAPI Credential Migration and Provider Resolver | implementation | codex | backlog | WP-7D-04 | no |
| WP-7D-06 | 7D | Connection Health Rotation UI and Audit | implementation | cursor | backlog | WP-7D-04, WP-7D-05 | no |
| WP-7D-07 | 7D | Provider Connection Security Review | review | claude | backlog | WP-7D-03, WP-7D-04, WP-7D-05, WP-7D-06 | no |

## Phase 7E - Server Job / Event Engine

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7E-01 | 7E | Job State Machine Specification | specification | claude | ready | - | no |
| WP-7E-02 | 7E | Queue Abstraction and Selection | specification | codex | ready | - | no |
| WP-7E-03 | 7E | Job Event Model and Audit Timeline | specification | codex | ready | - | no |
| WP-7E-04 | 7E | Job Schema Migration and Persistence | implementation | codex | backlog | WP-7D-07, WP-7E-01, WP-7E-03 | yes |
| WP-7E-05 | 7E | Queue Implementation and Dispatcher | implementation | codex | backlog | WP-7E-02, WP-7E-04 | no |
| WP-7E-06 | 7E | Worker Runtime and Provider Worker Adapter | implementation | codex | backlog | WP-7D-05, WP-7E-05 | no |
| WP-7E-07 | 7E | Webhook Ingress and Verification | implementation | codex | backlog | WP-7E-03, WP-7E-06 | no |
| WP-7E-08 | 7E | Retry Timeout Cancellation and Idempotency | implementation | claude | backlog | WP-7E-06, WP-7E-07 | no |
| WP-7E-09 | 7E | Recovery Reconciliation Observability | implementation | codex | backlog | WP-7E-08 | no |
| WP-7E-10 | 7E | Job Engine Load Failure and Integration Tests | review | codex | backlog | WP-7E-04, WP-7E-05, WP-7E-06, WP-7E-07, WP-7E-08, WP-7E-09 | no |

## Phase 7F - Project Graph + Memory

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7F-01 | 7F | Project Graph Ontology and Edge Taxonomy | specification | claude | ready | - | no |
| WP-7F-02 | 7F | Graph Persistence and Query Service | implementation | codex | backlog | WP-7C-23, WP-7E-10, WP-7F-01 | yes |
| WP-7F-03 | 7F | Memory Knowledge and Decision Records | implementation | claude | backlog | WP-7F-02 | yes |
| WP-7F-04 | 7F | Conversation and Provenance Graph Integration | implementation | codex | backlog | WP-7F-02, WP-7F-03 | no |
| WP-7F-05 | 7F | Asset Domain Relationship Backfill and Guards | implementation | codex | backlog | WP-7F-04 | no |
| WP-7F-06 | 7F | Agent Memory Retrieval and Context Assembler | implementation | claude | backlog | WP-7F-03, WP-7F-04 | no |
| WP-7F-07 | 7F | Graph and Memory Evaluations | review | claude | backlog | WP-7F-02, WP-7F-03, WP-7F-04, WP-7F-05, WP-7F-06 | no |

## Phase 7G - Capability / Model Registry

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7G-01 | 7G | Capability Taxonomy and Model Domain Specification | specification | claude | ready | - | no |
| WP-7G-02 | 7G | Registry Schema Provider Mappings and Versions | implementation | codex | backlog | WP-7D-07, WP-7F-07, WP-7G-01 | yes |
| WP-7G-03 | 7G | Cost Latency Quality and Availability Metadata | implementation | codex | backlog | WP-7G-02 | no |
| WP-7G-04 | 7G | Capability Resolver Routing and Entitlement Hooks | implementation | claude | backlog | WP-7D-05, WP-7G-03 | no |
| WP-7G-05 | 7G | Registry Administration and Tests | implementation | cursor | backlog | WP-7G-02, WP-7G-03, WP-7G-04 | no |

## Phase 7H - Character Identity Profiles

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7H-01 | 7H | Identity Profile Domain and Consent Specification | specification | claude | ready | - | no |
| WP-7H-02 | 7H | Character Identity Profile Schema and Provenance | implementation | codex | backlog | WP-7G-05, WP-7H-01 | yes |
| WP-7H-03 | 7H | Dynaxis Reference Profile and Provider Adapter | implementation | codex | backlog | WP-7H-02 | no |
| WP-7H-04 | 7H | Soul ID Attachment and Open Provider Adapters | implementation | claude | backlog | WP-7H-03 | no |
| WP-7H-05 | 7H | Character Studio Identity Integration and Evaluations | implementation | cursor | backlog | WP-7H-02, WP-7H-03, WP-7H-04 | no |

## Phase 7I - Agent / Engineering Contracts

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-7I-01 | 7I | Agent Role and Permission Contract Specification | specification | claude | ready | - | no |
| WP-7I-02 | 7I | Engineering WorkPackage Runtime Contract | implementation | claude | backlog | WP-7C-23, WP-7E-10, WP-7F-07, WP-7I-01 | yes |
| WP-7I-03 | 7I | WorkerAdapter and Capability Contract | implementation | codex | backlog | WP-7I-02 | no |
| WP-7I-04 | 7I | VerificationGate and Execution Result Contract | implementation | claude | backlog | WP-7I-02 | no |
| WP-7I-05 | 7I | Agent Contract Fixtures Audit and Provenance Tests | review | codex | backlog | WP-7I-02, WP-7I-03, WP-7I-04 | no |

## Phase 8A - App Factory Core

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8A-01 | 8A | App IR Specification and Versioning | specification | claude | ready | - | no |
| WP-8A-02 | 8A | App IR Validation and Persistence | implementation | codex | backlog | WP-7C-23, WP-7F-07, WP-7I-05, WP-8A-01 | yes |
| WP-8A-03 | 8A | Software Component Contract and Registry | implementation | claude | backlog | WP-8A-02 | yes |
| WP-8A-04 | 8A | Blueprint and Application Capability Registries | implementation | claude | backlog | WP-7G-05, WP-8A-03 | yes |
| WP-8A-05 | 8A | Repository Model Verification States and Provenance | implementation | codex | backlog | WP-7I-05, WP-8A-04 | yes |
| WP-8A-06 | 8A | App Factory Package Import Export Boundaries | implementation | codex | backlog | WP-8A-02, WP-8A-03, WP-8A-04, WP-8A-05 | no |
| WP-8A-07 | 8A | App Factory Core Integration Tests | review | codex | backlog | WP-8A-02, WP-8A-03, WP-8A-04, WP-8A-05, WP-8A-06 | no |

## Phase 8B - Build Runtime

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8B-01 | 8B | Brief Intake and Requirements Extraction | specification | codex | backlog | WP-8A-01 | no |
| WP-8B-02 | 8B | Architecture Planning Blueprint and Component Selection | implementation | claude | backlog | WP-8A-07, WP-8B-01 | no |
| WP-8B-03 | 8B | Engineering Work Package Generation | implementation | codex | backlog | WP-7I-05, WP-8A-07, WP-8B-02 | no |
| WP-8B-04 | 8B | Repository Bootstrap and GitHub Branch Management | implementation | codex | backlog | WP-8A-05, WP-8B-03 | no |
| WP-8B-05 | 8B | Worker Dispatch Build Test and Verification Gates | implementation | codex | backlog | WP-7E-10, WP-7I-05, WP-8B-04 | no |
| WP-8B-06 | 8B | Repair Loop Preview Environment and Deployment Boundary | implementation | codex | backlog | WP-8B-05 | no |
| WP-8B-07 | 8B | Build Runtime Evaluations | review | codex | backlog | WP-8B-02, WP-8B-03, WP-8B-04, WP-8B-05, WP-8B-06 | no |

## Phase 8C - Composer

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8C-01 | 8C | Composer Sequence Domain and Render Graph Specification | specification | claude | ready | - | no |
| WP-8C-02 | 8C | Tracks Clips Timeline Persistence | implementation | codex | backlog | WP-7E-10, WP-7F-07, WP-7G-05, WP-8C-01 | yes |
| WP-8C-03 | 8C | Timeline Editor and Program Monitor UI | implementation | cursor | backlog | WP-8C-02 | no |
| WP-8C-04 | 8C | Media Import Generative Blocks and Reference Frames | implementation | codex | backlog | WP-8C-02 | no |
| WP-8C-05 | 8C | Effects Transitions Audio and Templates | implementation | codex | backlog | WP-8C-02 | no |
| WP-8C-06 | 8C | FFmpeg Render Workers and Job Integration | implementation | codex | backlog | WP-7E-10, WP-8C-02, WP-8C-05 | no |
| WP-8C-07 | 8C | Composer Domain Integration Tests and Evaluations | review | codex | backlog | WP-8C-02, WP-8C-03, WP-8C-04, WP-8C-05, WP-8C-06 | no |

## Phase 8D - Responsive Design / Auto Layout

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8D-01 | 8D | Layout IR and Responsive State Specification | specification | claude | backlog | WP-8A-01 | no |
| WP-8D-02 | 8D | Stack Constraints Padding Gaps and Sizing Rules | implementation | codex | backlog | WP-8A-07, WP-8D-01 | yes |
| WP-8D-03 | 8D | Breakpoint Screen Model and Component Layout | implementation | codex | backlog | WP-8D-02 | yes |
| WP-8D-04 | 8D | Visual Inspector and Design Canvas UI | implementation | cursor | backlog | WP-8D-02, WP-8D-03 | no |
| WP-8D-05 | 8D | App IR Bridge and Code Generation Bridge | implementation | codex | backlog | WP-8A-07, WP-8D-03 | no |
| WP-8D-06 | 8D | Responsive Design Tests and Visual Evaluations | review | codex | backlog | WP-8D-02, WP-8D-03, WP-8D-04, WP-8D-05 | no |

## Phase 8E - Skills

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8E-01 | 8E | Skill Manifest Registry and Package Format | specification | claude | backlog | WP-7E-01, WP-7G-01, WP-7I-01 | no |
| WP-8E-02 | 8E | Skill Permissions Invocation IO and Versioning | implementation | codex | backlog | WP-7C-23, WP-7E-10, WP-7G-05, WP-7I-05, WP-8E-01 | yes |
| WP-8E-03 | 8E | Skill Dependencies Authoring and Test Harness | implementation | codex | backlog | WP-8E-02 | no |
| WP-8E-04 | 8E | Official Dynaxis Skills and Workflow Integration | implementation | codex | backlog | WP-8E-02, WP-8E-03 | no |
| WP-8E-05 | 8E | Agent Integration and Skill Runtime Tests | review | codex | backlog | WP-8E-02, WP-8E-03, WP-8E-04 | no |

## Phase 8F - Developer Platform

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8F-01 | 8F | Public API v1 and OpenAPI Contract | specification | codex | ready | - | no |
| WP-8F-02 | 8F | API Auth Developer Applications and Credentials | implementation | codex | backlog | WP-7C-23, WP-8F-01 | yes |
| WP-8F-03 | 8F | Public Webhooks Logs Usage and Sandbox | implementation | codex | backlog | WP-7E-10, WP-8F-02 | yes |
| WP-8F-04 | 8F | TypeScript SDK Python SDK Seam and CLI | implementation | codex | backlog | WP-8F-02, WP-8F-03 | no |
| WP-8F-05 | 8F | MCP Server and Developer Console UI | implementation | cursor | backlog | WP-8F-02, WP-8F-03, WP-8F-04 | no |
| WP-8F-06 | 8F | Developer Documentation and Compatibility Tests | review | codex | backlog | WP-8F-02, WP-8F-03, WP-8F-04, WP-8F-05 | no |

## Phase 8G - Extension / Plugin Platform

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8G-01 | 8G | Plugin Manifest Package Permissions and Capabilities | specification | codex | ready | - | no |
| WP-8G-02 | 8G | Plugin SDK Runtime Sandbox and Extension Points | implementation | codex | backlog | WP-8E-05, WP-8F-06, WP-8G-01 | no |
| WP-8G-03 | 8G | Signing Integrity Dependency and Compatibility Model | implementation | codex | backlog | WP-8G-02 | no |
| WP-8G-04 | 8G | Install Upgrade Rollback and Test Harness | implementation | codex | backlog | WP-8G-03 | yes |
| WP-8G-05 | 8G | Plugin Platform Security Review | review | claude | backlog | WP-8G-02, WP-8G-03, WP-8G-04 | no |

## Phase 8H - Marketplace

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-8H-01 | 8H | Marketplace Package Contract and Publisher Model | specification | codex | ready | - | no |
| WP-8H-02 | 8H | Catalogue Search Categories and Package Pages | implementation | cursor | backlog | WP-8F-06, WP-8G-05, WP-8H-01 | yes |
| WP-8H-03 | 8H | Versions Installation Updates and Uninstall | implementation | codex | backlog | WP-8H-02 | yes |
| WP-8H-04 | 8H | Licensing Entitlements Collections and Profiles | implementation | cursor | backlog | WP-8H-03 | yes |
| WP-8H-05 | 8H | Publishing Verification Moderation and Reporting | implementation | codex | backlog | WP-8H-02, WP-8H-04 | no |
| WP-8H-06 | 8H | Creator Analytics Private Packages and Partner Tiers | implementation | cursor | backlog | WP-8H-04, WP-8H-05 | no |
| WP-8H-07 | 8H | Marketplace Integration and Governance Review | review | claude | backlog | WP-8H-02, WP-8H-03, WP-8H-04, WP-8H-05, WP-8H-06 | no |

## Phase 9 - Supercomputer

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-9-01 | 9 | Supercomputer Planning Contract and Safety Model | specification | claude | ready | - | no |
| WP-9-02 | 9 | Context Assembly Memory Retrieval and Skill Selection | implementation | codex | backlog | WP-7F-07, WP-8E-05, WP-9-01 | no |
| WP-9-03 | 9 | Agent Registry Worker Selection and Capability Planning | implementation | codex | backlog | WP-7I-05, WP-8E-05, WP-9-02 | no |
| WP-9-04 | 9 | Engineering Dependency Planning Scheduler and Budgets | implementation | codex | backlog | WP-7E-10, WP-9-03 | no |
| WP-9-05 | 9 | Human Approvals Verification Loops and Recovery | implementation | codex | backlog | WP-9-04 | no |
| WP-9-06 | 9 | Multi Agent Delegation Execution Trace and UI | implementation | cursor | backlog | WP-9-05 | no |
| WP-9-07 | 9 | Supercomputer Evaluations Security and Safety Review | review | claude | backlog | WP-9-02, WP-9-03, WP-9-04, WP-9-05, WP-9-06 | no |

## Phase 10 - Production / Commercial Hardening

| ID | Phase | Title | Type | Recommended Agent | Status | Depends On | Migration Owner |
|---|---|---|---|---|---|---|---|
| WP-10-01 | 10 | Billing Credits Usage Metering Plans and Entitlements | implementation | codex | backlog | WP-7C-23, WP-8F-06 | yes |
| WP-10-02 | 10 | Marketplace Purchasing and Creator Payouts | implementation | codex | backlog | WP-8H-07, WP-10-01 | yes |
| WP-10-03 | 10 | Observability Metrics Tracing and SLOs | implementation | codex | backlog | WP-7E-10, WP-8F-06 | no |
| WP-10-04 | 10 | Admin Console and Support Tooling | implementation | cursor | backlog | WP-10-03 | yes |
| WP-10-05 | 10 | Audit Abuse Prevention and Security Remediation | implementation | claude | backlog | WP-7C-23, WP-8F-06, WP-10-03 | yes |
| WP-10-06 | 10 | Data Export Deletion Retention and Compliance | implementation | codex | backlog | WP-10-05 | yes |
| WP-10-07 | 10 | Backups Restore Disaster Recovery and Failure Injection | implementation | codex | backlog | WP-10-03, WP-10-06 | no |
| WP-10-08 | 10 | Load Tests Scaling Feature Flags and Deployment Controls | implementation | codex | backlog | WP-10-03, WP-10-07 | no |
| WP-10-09 | 10 | Incident Response Tooling and Production Readiness Gate | integration | codex | backlog | WP-10-02, WP-10-04, WP-10-05, WP-10-06, WP-10-07, WP-10-08 | no |
