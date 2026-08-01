# Phase 7E - Job / Event Engine Foundation Scaffold

## Status

This branch delivers scaffold-only contracts for Phase 7E Job/Event Engine.
No persistence, queue runtime, worker runtime, webhooks, schema, or migrations
are included.

## Purpose

Provide a stable contract surface so later work packages can implement runtime
behavior without inventing states, events, idempotency semantics, or safety
boundaries.

## Canonical Job State Contract

Defined in `lib/dynaxis/jobs/state-machine.js` and `lib/dynaxis/jobs/contracts.js`.

- States: `queued`, `leased`, `running`, `waiting_retry`, `completed`, `failed`, `cancelled`, `timed_out`
- Terminal states: `completed`, `failed`, `cancelled`
- Transition validation is pure and in-memory
- Retry/cancellation/timeout semantics are explicit and deterministic

## Event Contract

Defined in `lib/dynaxis/jobs/events.js` and `lib/dynaxis/jobs/contracts.js`.

- Canonical event names:
  - `job.created`
  - `job.dispatched`
  - `job.provider_updated`
  - `job.retried`
  - `job.completed`
  - `job.failed`
  - `job.cancelled`
  - `job.reconciled`
- Event payloads are redacted for sensitive fields before returning event objects
- Correlation ids are validated and normalized to safe string fields

## Idempotency Contract

Defined in `lib/dynaxis/jobs/idempotency.js`.

- Idempotency keys are normalized by trimming, lowercasing, and whitespace collapsing
- Empty keys are rejected
- Keys exceeding the max supported length are rejected

## Worker Dispatch Boundary (Explicit Blocker)

Defined in `lib/dynaxis/jobs/contracts.js`.

- ProviderConnection use from worker dispatch is explicitly blocked in scaffold
- `assertWorkerProviderConnectionBlocked()` throws with a dedicated error code
- This is intentional and fail-closed until a tested service-principal allowlist exists

## Downstream Ownership

- `WP-7E-04` owns persistence and migration later
- `WP-7E-05` owns queue implementation and dispatcher later
- `WP-7E-06` owns worker runtime later
- `WP-7E-06` must not use ProviderConnections until an explicit, tested service-principal allowlist exists

## Scope Boundaries (Scaffold Only)

- No database access
- No queue implementation
- No worker execution loop
- No webhook ingress or verification
- No ProviderConnection usage from workers
- No schema or migration work

