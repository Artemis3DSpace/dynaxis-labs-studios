# Phase 7B - Generation Provider Kernel

**Status:** Implemented foundation.
**Branch:** `phase-7b/generation-provider-kernel`

Phase 7B establishes the provider-neutral creative generation kernel without changing runtime UI, database migrations, package dependencies, or provider secrets.

## Implemented

- Provider-neutral provider id helpers and known provider vocabulary.
- Generation Provider contract requiring `submit`, `retrieve`, and `cancel`.
- Provider Registry with deterministic registration, lookup, replacement, listing, and not-found behavior.
- Production provider registry containing only MuAPI.
- Provider-neutral capability vocabulary for generation surfaces.
- Provider-neutral status normalization, output URL extraction, payload sanitization, and provider error taxonomy.
- Generation Gateway request/result boundary with injectable provider registry support.
- MuAPI adapter compatibility behind the provider contract.
- Lifecycle provider normalization and validation before Generation / Job creation.
- Lifecycle invariant checks ensuring a Job belongs to the Generation, Project, and provider being completed or failed.

## Preserved

- Current MuAPI submit/retrieve behavior.
- Existing Studio `submitAndPoll` lifecycle.
- Existing Mini App generation executor flow.
- Existing database schema and migrations.
- Existing package manifests and configuration.
- Existing client/server module boundaries.

## Explicitly Not Implemented

- Higgsfield, Fal, Replicate, or local inference provider adapters.
- Provider Connections / Secrets.
- Dynaxis identity, organizations, or permissions.
- Durable server job queue, worker, webhook, event engine, retries, or cancellation runtime.
- Billing, credits, cost estimation, or provider entitlements.
- Governed Capability / Model Registry database.
- Character identity profile persistence.
- App Factory, Composer, Auto Layout, Skills, or Supercomputer work.

## Phase Boundary

The provider kernel is a contract and adapter boundary. It makes generation provider-neutral at the platform layer, but it does not make Dynaxis the durable execution authority. Durable execution belongs to Phase 7E and depends on identity plus Provider Connections / Secrets.
