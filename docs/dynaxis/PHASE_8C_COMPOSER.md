# Phase 8C - Composer Domain Scaffold

## Status

This document captures the production-grade scaffold for the Composer domain
contracts in Phase 8C.

The implementation is limited to pure domain contracts and validation.

## Implemented Contract Surface

- sequence contract (`sequence.js`)
- timeline contract (`timeline.js`)
- track contract (`tracks.js`)
- clip contract (`clips.js`)
- media reference contract (`media-contracts.js`)
- generative block placeholder contract (`media-contracts.js`)
- render graph node/edge contract (`render-graph.js`)
- effect stack contract (`effects-contracts.js`)
- export target contract (`effects-contracts.js`)

## Explicit Non-Goals In This Scaffold

- no persistence
- no schema or drizzle changes
- no migrations
- no FFmpeg worker integration
- no render job engine integration
- no ProviderConnection runtime integration
- no timeline editor UI

## Invariants

- clip timing must have positive visible duration after trim
- clip end cannot exceed timeline duration
- non-overlap tracks reject overlapping clips
- media references require provenance
- generative placeholders reject secret-bearing/provider-connection fields
- render graph edges must reference known nodes
- render graph must be acyclic
- export targets must satisfy type/container compatibility

## Validation

Two dedicated tests verify this scaffold:

- `tests/dynaxis-composer-sequence.test.mjs`
- `tests/dynaxis-composer-render-graph.test.mjs`
