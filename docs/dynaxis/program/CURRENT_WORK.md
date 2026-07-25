# Current Dynaxis Work

## Current Programme

Phase 7C with parallel specification-only planning.

## Completed

- 7C.1
- 7C.2
- 7C.3

## In Progress

7C.4 Canonical Workspace Ownership

- Agent: Codex
- Branch: `phase-7c/identity-organizations-permissions`
- Tracking Work Package: `WP-7C-04`

Do not claim 7C.4 is complete until its assigned Work Package has passed review and integration. It remains the active migration owner on the Phase 7C implementation line.

## Ready Work Packages

- WP-7D-01 ProviderConnection Contract and Threat Model
- WP-7D-02 Secret Storage and Key Management Architecture
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

Only specification-only Work Packages are READY while 7C.4 is active. They may inspect runtime code and architecture documents, but they must not edit `lib/**`, `app/**`, `packages/**`, `drizzle/**`, runtime schemas, production APIs, or product UI.

## Blocked Runtime Implementation

All runtime implementation packages remain backlog until their dependencies are integrated and migration ownership is available.

## Next Sequential Identity Tasks

1. 7C.5 Project Membership
2. 7C.6 Authorization
3. 7C.7 AuthContext
4. 7C.8 Route Migration
5. 7C.9 Client/Session Migration + TanStack Query
6. 7C.10 Identity/Security Hardening
