# Phase 8A App Factory Core

This document records the Phase 8A scaffold boundaries for the App Factory Core and App IR contract layer.

## Current Delivery Scope

The current scaffold adds contract definitions and pure validation in `lib/dynaxis/app-factory/**` with tests in `tests/dynaxis-app-*.test.mjs`.

Included:

- App IR v0 contract shape.
- App IR version compatibility helpers.
- App IR validation invariants.
- Component and blueprint contract scaffolds.
- Package export boundary stripping for runtime-only/internal fields.

Explicitly excluded:

- Database persistence.
- Schema changes.
- Drizzle changes.
- Migrations.
- Repository generation and provider repository actions.
- Worker dispatch or runtime execution.

## Work Package Ownership Boundaries

- `WP-8A-01` owns specification/versioning.
- `WP-8A-02` owns persistence implementation later.
- `WP-8A-03` owns software component registry implementation later.
- `WP-8A-04` owns blueprint and capability registries implementation later.
- `WP-8A-05` owns repository model, verification states, and provenance persistence later.
- `WP-8A-06` owns import/export workflow behavior later.

## Contract Notes

- App IR remains a pure contract in this phase scaffold.
- Validation is deterministic and side-effect free.
- No runtime job or repository side effects are allowed in this layer.
