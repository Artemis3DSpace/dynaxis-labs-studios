# WP-7E-01 Handoff - Job State Machine Specification

## Branch

- Branch: `phase-7e/job-state-machine-spec`
- Worktree: `/Users/sotiratrifourki/Documents/dynaxis-labs-studios-July-26/dynaxis-labs-studios-phase-7e-job-state-machine-spec`
- Starting SHA: `b94e912db858cf7e1ce915f6ceae5e968726e488`

## Scope Completed

- Added `docs/dynaxis/PHASE_7E_JOB_STATE_MACHINE.md`.
- Updated WP-7E-01 metadata to `status: review` with branch, worktree, and base SHA.
- Updated programme status surfaces so WP-7E-01 is no longer listed as ready work.

## Contract Summary

- The Job Engine is the durable execution authority upstream of provider adapters, webhooks, retries, reconciliation, and asset registration.
- Canonical states are `queued`, `dispatching`, `submitted`, `processing`, `retry_scheduled`, `cancelling`, `succeeded`, `failed`, `cancelled`, and `timed_out`.
- Terminal states are `succeeded`, `failed`, `cancelled`, and `timed_out`.
- Provider job ids are attempt-scoped metadata and never replace Dynaxis Job ids.
- Provider metadata is evidence only: sanitized, bounded, provider-scoped, and non-authoritative.
- Cancellation, timeout, retry, and reconciliation are Dynaxis policy decisions validated through the Job Engine.

## Follow-On Owners

- WP-7E-03 owns event schema detail.
- WP-7E-04 owns schema migration, persistence, indexes, transition guards, attempts, leases, idempotency, and callback lookup.
- WP-7E-05 owns queue implementation and dispatcher behavior.
- WP-7E-07 owns webhook ingress and verification.
- WP-7E-08 owns retry, timeout, cancellation, and idempotency implementation.
- WP-7E-09 owns recovery reconciliation and observability implementation.

## Migration Status

No migration. WP-7E-01 is specification-only.
