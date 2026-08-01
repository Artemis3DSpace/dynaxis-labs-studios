# Phase 7H - Workspace Intelligence Domain Scaffold

## Status

This scaffold introduces pure domain contracts for workspace intelligence.
It is scaffold only and includes no runtime integrations.

No event ingestion is implemented.
No persistence or migration work is included.
No AI summarisation or model routing is included.

## Contract Surface

`lib/dynaxis/workspace-intelligence/` defines:

- `activity-contracts.js`: workspace/project activity event contracts.
- `signal-classification.js`: stable signal-classification vocabulary.
- `insight-contracts.js`: insight candidate and validation result contracts.
- `summary-contracts.js`: workspace summary placeholder-only contract.
- `recommendation-contracts.js`: recommendation placeholder-only contract.
- `privacy-boundaries.js`: privacy boundary and redaction contract helpers.
- `index.js`: public scaffold exports.

## Invariants

- Activity contracts require actor, source, kind, and timestamp.
- Activity visibility is constrained to `public`, `internal`, or `private`.
- Insight candidates require provenance and evidence references.
- Summary and recommendation contracts remain placeholder-only for this phase.
- Public projection contracts reject raw secret-like values.

## Non-goals

- No event ingestion implementation.
- No persistence/migration/schema work.
- No workers, notifications, or external API integrations.
- No AI summarisation or model-routing implementation.

## Forward Linkage

Later phases may connect workspace intelligence contracts to:

- Project Graph memory/context surfaces
- Jobs state/event runtime
- Agent contract execution and verification gates
- Build Runtime orchestration boundaries
