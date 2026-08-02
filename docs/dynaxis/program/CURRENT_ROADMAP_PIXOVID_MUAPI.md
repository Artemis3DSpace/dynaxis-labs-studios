# Dynaxis Current Roadmap Checkpoint — Pixovid / MuAPI Context

## Purpose

This checkpoint restores the original product goal alignment for Dynaxis Labs Studios:
Dynaxis is intended to become a production-grade creative AI app factory, with
the first creative product target centered on Pixovid/MuAPI-style image and
video generation workflows.

## Product Direction (Restated)

- Dynaxis Labs Studios is meant to become a production-grade creative AI app factory.
- The first creative product target is Pixovid/MuAPI-style image/video generation.
- Current Dynaxis includes substantial platform/backend foundations, but does not
  yet include a complete creative-generation backend runtime path.

## Pixovid Baseline (Reference Only)

Pixovid is treated as a product reference point, not an implementation drop-in.

- Pixovid is a full-stack generative-media SaaS with:
  - React/Vite frontend
  - Express backend
  - Prisma/Postgres
  - MinIO
  - OpenRouter
  - FaceFusion
- Pixovid does not use MuAPI out of the box.
- MuAPI compatibility requires a dedicated adapter and audit path.
- Pixovid should not be copied directly into Dynaxis.

## Roadmap Correction Track

Add and maintain a **Creative Provider Capability Layer** roadmap track that:

1. Preserves provider-neutral contracts in Dynaxis core.
2. Explicitly scopes provider capability mapping and compatibility surfaces.
3. Treats Pixovid and MuAPI parity as a governed integration objective rather
   than a direct code transplant.

## Safety / Sequencing Constraints (No New Runtime Work Here)

- `WP-7E-05` remains blocked until `WP-7E-02` is integrated **and** migration
  `0017` exists.
- `WP-7E-06` remains blocked by residual risk **R1**.
- Provider execution remains blocked until the Job/Worker/Security path is safe.
- This checkpoint does **not** authorize queue dispatch, worker runtime,
  ProviderConnection worker use, provider adapters, or OAuth implementation.

## Scope Boundary of This Checkpoint

This file is documentation-only programme guidance. It does not modify runtime
code, schema, migrations, ProviderConnection implementation, or secrets
implementation.
