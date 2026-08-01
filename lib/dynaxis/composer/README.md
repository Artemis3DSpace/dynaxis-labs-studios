# Dynaxis Composer Domain Scaffold

This directory defines the Phase 8C Composer contracts for:

- sequence
- timeline
- tracks
- clips
- media references
- generative block placeholders
- render graph nodes/edges
- effect stacks
- export targets

## Scope

This scaffold is intentionally pure-domain validation:

- no database access
- no schema or drizzle edits
- no migrations
- no provider-connection lookups
- no render workers
- no job-engine integrations

## Modules

- `sequence.js` - top-level sequence contract
- `timeline.js` - timeline invariants and track registration rules
- `tracks.js` - overlap and track clip invariants
- `clips.js` - clip timing and clip-kind contracts
- `media-contracts.js` - media reference + generative placeholder contracts
- `render-graph.js` - DAG validation for render graph
- `effects-contracts.js` - effect stack + export target contracts
- `index.js` - stable public export surface
