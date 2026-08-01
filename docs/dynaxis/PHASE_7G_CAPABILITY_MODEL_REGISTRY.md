# Phase 7G - Capability / Model Registry Domain Scaffold

## Status

This scaffold introduces pure domain contracts for Phase 7G (WP-7G-01 scope).
It defines taxonomy/domain placeholders only.

It does not add registry persistence, resolver routing execution, provider
integration, or migrations.

## Contract Surface

`lib/dynaxis/capabilities/` defines:

- `taxonomy.js`: capability category constants and capability name normalization.
- `model-domain.js`: model-domain taxonomy and provider/model mapping contract
  placeholder validation.
- `resolver-contracts.js`: resolver decision and cost/latency/quality placeholder
  contracts.
- `index.js`: public scaffold exports.

## Core Vocabulary

- Capability categories: generation, transformation, analysis, verification,
  orchestration, integration.
- Model domain categories: image/video/audio/language generation, embedding,
  moderation, multimodal.
- Provider/model mapping placeholder: canonical provider id + model id + domain.
- Resolver contract placeholder: selected/fallback/denied/unresolved outcomes.

## Invariants

- Capability names normalize to lowercase kebab-case.
- Provider/model mappings reject unknown providers.
- Resolver placeholder contracts require normalized capability and known state.
- Cost/latency/quality placeholders validate numeric fields when provided.

## Non-goals

- No registry schema/migration work (WP-7G-02+).
- No runtime capability resolver implementation.
- No model routing or provider API calls.
