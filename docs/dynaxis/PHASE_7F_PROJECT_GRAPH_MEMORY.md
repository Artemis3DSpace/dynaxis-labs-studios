# Phase 7F - Project Graph + Memory Domain Scaffold

## Status

This scaffold introduces pure domain contracts for Phase 7F (WP-7F-01 scope).
It defines ontology and validation helpers only.

It does not add persistence, migrations, workers, runtime graph services, or
query execution.

## Contract Surface

`lib/dynaxis/project-graph/` defines:

- `ontology.js`: node kind vocabulary and graph relationship naming rules.
- `edges.js`: edge kind taxonomy and edge-shape validation.
- `memory-contracts.js`: memory record kinds, provenance, and decision record
  contract validation.
- `index.js`: public scaffold exports.

## Core Vocabulary

- Node kinds: project-graph entities for workspace/project/assets/jobs/generations,
  conversation/message, memory/decision records, agent and verification contracts.
- Edge kinds: typed relationship names linking project graph entities.
- Memory record kinds: contract values for observational and decision-input memory.
- Decision record kinds: contract values for capability/routing/verification decisions.

## Invariants

- Graph edges require `source`, `target`, and `kind`.
- Edge kinds must match known taxonomy.
- Memory and decision records require provenance payloads.
- Relationship names are lowercase snake_case contract identifiers.

## Non-goals

- No database schema or migration changes.
- No graph persistence/query implementation (WP-7F-02+).
- No worker integration or retrieval runtime.
