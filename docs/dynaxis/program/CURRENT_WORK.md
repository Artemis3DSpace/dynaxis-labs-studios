# Current Dynaxis Work

## Current Programme

Phase 7C with parallel specification-only planning.

## Completed

- 7C.1
- 7C.2
- 7C.3
- 7C.4 Canonical Workspace Ownership
- 7C.5 Project Membership Schema and Role Model

## In Progress

(none)

Phase 7C.5 is integrated. `WP-7C-05` is complete and its branch and implementation history are preserved on main.

`WP-7C-06` is the next ready Phase 7C implementation package. It has `migration_owner: false`, so no migration owner is active.

## Ready Work Packages

- WP-7C-06 Project Membership Service Invariants
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

Specification-only Work Packages may continue in parallel under their documented path restrictions. `WP-7C-06` is the next ready runtime implementation package and does not own a migration.

## Blocked Runtime Implementation

Runtime implementation packages after `WP-7C-06` remain backlog until their dependencies are integrated.

## Next Sequential Identity Tasks

1. WP-7C-06 Project Membership Service Invariants
2. Authorization
3. AuthContext
4. Route Migration
5. Client/Session Migration + TanStack Query
6. Identity/Security Hardening
