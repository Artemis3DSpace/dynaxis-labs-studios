# Dynaxis App Factory Core (Phase 8A Scaffold)

This module provides the App IR v0 contract scaffold for Phase 8A with pure validation and package-boundary logic only.

## Scope

- Defines App IR v0 field contract and version helpers.
- Validates App IR shape and invariants.
- Defines component and blueprint contract validators.
- Exports package-safe App IR payloads by removing runtime-only/internal fields.

## Out Of Scope

- Persistence, repositories, schema updates, and migrations.
- Git provider registration and repository generation.
- Worker dispatch and build-runtime execution.
- Marketplace or plugin lifecycle implementation.

## Work Package Ownership

- `WP-8A-01` owns App IR specification and versioning semantics.
- `WP-8A-02` owns persistence implementation later.
- `WP-8A-03` owns software component registry implementation later.
- `WP-8A-04` owns blueprint/capability registries implementation later.
- `WP-8A-05` owns repository model and verification-state provenance implementation later.
- `WP-8A-06` owns import/export workflows and conflict processing implementation later.
