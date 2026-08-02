# Handoff - WP-7E-01 and WP-7E-03 Job State and Event Specifications

**Type:** specification. Documentation only — no runtime code, schema, migration, queue, worker, webhook, or ProviderConnection use.

**Base `main`:** `b0b5555ab6a8b46100d19b19b58318220b3ec7b8`
**Branch:** `phase-7e/job-state-event-specs`
**Test baseline:** 664/664 passing, unchanged

## Delivered

| Package | Status | Document |
|---|---|---|
| WP-7E-01 Job State Machine Specification | **review** | `docs/dynaxis/PHASE_7E_JOB_STATE_MACHINE.md` |
| WP-7E-03 Job Event Model and Audit Timeline | **review** | `docs/dynaxis/PHASE_7E_JOB_EVENT_MODEL.md` |

Together these close the specification gap that gated **WP-7E-04 Job Schema
Migration and Persistence**, the sole reachable migration owner.

## Prior work reused

An unmerged branch `phase-7e/job-state-machine-spec` @ `9fc4c3e` already
contained a 497-line WP-7E-01 draft (`PHASE_7E_JOB_STATE_MACHINE.md`, plus
`handoffs/WP-7E-01_HANDOFF.md` and work-package metadata). It was inspected
first and **substantially reused**: the authority boundary, Job-identity rules,
provider-metadata contract, failure taxonomy, cancellation/timeout/retry/
reconciliation semantics, Generation/Asset coupling, and security rules are all
carried forward.

**It was not merged as-is, because its state vocabulary contradicts `main`.**
The draft predates both Phase 7D completion and the `SD-01` jobs scaffold.

## The conflict, and how it was resolved

`lib/dynaxis/jobs/contracts.js` is on `main`, tested by
`tests/dynaxis-jobs-state-machine.test.mjs` and
`tests/dynaxis-jobs-events.test.mjs`, and enforced by `canTransitionJobState`.
**The scaffold was treated as canonical**; the draft's names were mapped onto
it rather than the reverse. No runtime file was modified.

| Draft state | Scaffold state on `main` | Kind of change |
|---|---|---|
| `dispatching` | `leased` | rename |
| `submitted` + `processing` | `running` | **merged** |
| `retry_scheduled` | `waiting_retry` | rename |
| `succeeded` | `completed` | rename |
| `cancelling` | *(absent)* | **removed** |
| `timed_out` terminal | `timed_out` **non-terminal** | **semantic change** |

## Two decisions handed to WP-7E-04

These must be resolved **before schema is written**, and must not be settled by
silently editing the scaffold.

- **D1 — is `timed_out` terminal?** `TERMINAL_JOB_STATES` contains only
  `completed`, `failed`, `cancelled`. The scaffold allows
  `timed_out -> waiting_retry | failed | cancelled`, so **a timed-out Job is not
  finished**. Any UI, projection, or public API that presents it as finished is
  wrong. WP-7E-04 must either keep it non-terminal and define the settling
  transition, or promote it to terminal under its own change.
- **D2 — is an intermediate `cancelling` state needed?** Cancellation currently
  goes directly to `cancelled` from every non-terminal state, losing the
  "requested but provider not yet confirmed" window. WP-7E-04 must either carry
  that distinction as metadata or introduce the state.

## Phase 7D residual risks — unchanged

**R1 remains binding and is restated in both specifications.**
`assertWorkerProviderConnectionBlocked()` throws `501` unconditionally and
`WORKER_PROVIDER_CONNECTION_POLICY.status` is `blocked`. **WP-7E-06 must not use
ProviderConnections until an explicit, tested service-principal allowlist
exists.** WP-7E-04 must not weaken that guard, and persisting job state does not
resolve R1.

**R3 is explicitly not closed by this work.** The Job event timeline is a
*different boundary* from the Phase 7D provider-connection audit sink, which is
still in-memory and still has no migration owner. Persisting job events must not
be mistaken for durable provider audit. This is recorded in
`PHASE_7E_JOB_EVENT_MODEL.md` §8 and in `CONFLICT_MATRIX.md`.

R2, R4, R5, R6 unchanged.

## Status after this handoff

| Package | Status |
|---|---|
| WP-7E-01 | review |
| WP-7E-02 Queue Abstraction and Selection | ready, **not started** |
| WP-7E-03 | review |
| WP-7E-04 Job Schema Migration and Persistence | backlog — **next implementation candidate** once 7E-01/03 integrate |
| WP-7E-05 Queue Implementation and Dispatcher | backlog, **not started** |
| WP-7E-06 Worker Runtime and Provider Worker Adapter | backlog, **blocked by R1** |

## Guidance for the next agent

1. Integrate this branch before starting WP-7E-04.
2. Read `PHASE_7E_JOB_STATE_MACHINE.md` §15 for the minimum persistence surface
   and `PHASE_7E_JOB_EVENT_MODEL.md` §7 for the event record shape.
3. Resolve D1 and D2 explicitly, in writing, as part of WP-7E-04.
4. WP-7E-04 is a **migration owner**. Per `CONFLICT_MATRIX.md`, claim it
   explicitly; migrations currently stop at `0015`.
5. Do not start WP-7E-05 or WP-7E-06.
6. The old branch `phase-7e/job-state-machine-spec` @ `9fc4c3e` can be retired
   once this lands — its content is superseded. It was **not** deleted or
   modified by this work.
