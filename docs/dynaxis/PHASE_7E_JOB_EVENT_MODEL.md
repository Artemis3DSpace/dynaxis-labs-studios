# Phase 7E - Job Event Model and Audit Timeline Specification

**Work Package:** WP-7E-03
**Status:** specification. No runtime code, schema, migration, queue, worker, webhook, or durable audit sink is implemented by this document.
**Base:** `main` @ `b0b5555ab6a8b46100d19b19b58318220b3ec7b8`, 664/664 passing.
**Depends on:** WP-7E-01 Job State Machine (`PHASE_7E_JOB_STATE_MACHINE.md`).
**Blocks:** WP-7E-04 Job Schema Migration and Persistence, WP-7E-07 Webhook Ingress and Verification.

## 0. Relationship to the SD-01 scaffold on main

The event contract is partially present in `lib/dynaxis/jobs/` (inventory
`SD-01`): `JOB_EVENT_NAMES`, `REDACTED_EVENT_PAYLOAD_KEYS`, and
`CORRELATION_ID_FIELDS` in `contracts.js`; `redactEventPayload()` and
`validateCorrelationIds()` in `events.js`; tested by
`tests/dynaxis-jobs-events.test.mjs`.

**The scaffold is canonical for event names and redaction keys.** It is
contract-only: events are constructed and redacted in memory and **nothing is
stored**. Every durability requirement below is a requirement on WP-7E-04, not a
description of current behaviour.

## 1. Canonical Job Event Kinds

Source of truth: `JOB_EVENT_NAMES` in `lib/dynaxis/jobs/contracts.js`.

| Event | Emitted when | Typical state effect |
|---|---|---|
| `job.created` | A Job is accepted and persisted. | *(none)* -> `queued` |
| `job.dispatched` | The dispatcher leases the Job and hands it to a worker/adapter. | `queued` -> `leased`, and `leased` -> `running` on submit |
| `job.provider_updated` | Provider evidence arrives via poll, webhook, or worker: progress, status, or metadata. | none, or `leased` -> `running` |
| `job.retried` | A new attempt is scheduled or started. | `* -> waiting_retry`, `waiting_retry -> queued` |
| `job.completed` | Success evidence accepted **and** required output registration committed. | `running` -> `completed` |
| `job.failed` | Non-retryable failure or exhausted budget. | `* -> failed` |
| `job.cancelled` | Cancellation finalized. | `* -> cancelled` |
| `job.reconciled` | The reconciler made a decision about a stale or divergent Job. | any legal transition, or none |

Rules:

- The event vocabulary is **closed**. Emitting an unrecognized name is an
  `INVALID_JOB_EVENT` error.
- Events are **evidence and history**, never authority. An event never causes a
  transition by itself; the Job Engine validates the transition and then emits
  the event.
- There is **no dedicated timeout event.** A timeout surfaces as `job.failed`
  with failure kind `timeout`, or as `job.reconciled` when the reconciler settles
  a `timed_out` Job. WP-7E-04 must record which deadline was exceeded in the
  payload. If decision **D1** in `PHASE_7E_JOB_STATE_MACHINE.md` §3.1 promotes
  `timed_out` to terminal, a `job.timed_out` event should be added at that time.
- `job.provider_updated` may be emitted many times per attempt and must be
  safely deduplicable — it is the highest-volume event and the most likely to be
  redelivered by webhooks.

## 2. Actor And Principal Attribution

Every event must record who or what caused it. Attribution is **descriptive
metadata, not authorization**.

| Actor kind | Example | Notes |
|---|---|---|
| `user` | A workspace member cancelling a Job | Canonical Dynaxis principal id; authorization already checked upstream. |
| `service` | Generation Gateway creating a Job | Must be explicit, scoped, and audited. |
| `worker` | Worker runtime reporting submit or failure | **Not a principal for user permissions.** |
| `provider` | Webhook or poll evidence | Provider origin only. Verifies nothing about user authority. |
| `system` | Reconciler, timeout scheduler, retry scheduler | Internal automation. |

Binding rules:

- Provider credentials, provider job ids, worker ids, queue leases, and webhook
  signatures **must never** be recorded as an identity subject. They are
  correlation metadata. This restates the Phase 7D security review finding that
  provider credentials are not identity.
- A `provider` or `worker` actor must never be projected to a browser as though
  it were a Dynaxis user.
- Legacy `x-api-key` callers are recorded as a compatibility principal with no
  ProviderConnection authority (Phase 7D residual risk R6).
- Where an event results from an authorized request, the event must carry the
  canonical principal id that passed the permission check — not the connection,
  credential, or account that executed the work.

## 3. Payload Projection And Redaction Rules

Source of truth: `REDACTED_EVENT_PAYLOAD_KEYS` in `contracts.js`, applied by
`redactEventPayload()` in `events.js`.

Redacted keys, replaced with the sentinel `[REDACTED]`:

```text
apiKey, token, accessToken, refreshToken, authorization,
secret, secretRef, keyRef, encryptedPayload, authTag, iv, aad,
rawCredential, providerCredential
```

Rules:

- Redaction is **recursive** through nested objects and arrays. Depth does not
  exempt a key.
- Redaction is **key-based and exception-free**. There is no "safe context" in
  which a redacted key may be emitted.
- A non-object payload raises `INVALID_EVENT_PAYLOAD`.
- The redacted form is what may be persisted and projected. The unredacted form
  must never leave the server boundary.
- This list must stay **at least as strict** as the Phase 7D browser redaction
  rules, which are exception-free and include `algorithm`. If a Job event ever
  carries key-management state, `algorithm` and any envelope/KMS field must be
  added here before that event is emitted. WP-7E-04 must not relax this list.
- Provider error bodies and diagnostics are sanitized and bounded before
  storage. User-facing error text must be user-safe, redacted, and length-capped.

Projection tiers WP-7E-04 must define separately:

| Tier | Audience | Contents |
|---|---|---|
| server | Job Engine, reconciler, forensic queries | Redacted payload plus sanitized provider diagnostics and internal correlation. |
| workspace | Authorized users with `job.read` | State changes, timestamps, attempt numbers, user-safe error text, actor kind. No provider diagnostics, no internal ids beyond the Job/attempt. |
| public API | Future WP-8F Developer Platform | Strict allowlist. Nothing is exposed by default. |

Projection must be **allowlist-based**, matching the Phase 7D pattern. A new
payload field is invisible until explicitly allowed at a tier.

## 4. Correlation And Idempotency Metadata

Source of truth: `CORRELATION_ID_FIELDS` in `contracts.js`, validated by
`validateCorrelationIds()`.

```text
requestId, generationId, assetId, jobId, providerJobId, workspaceId
```

Rules:

- Each present field must be a non-empty string; absent fields are omitted, not
  nulled. A non-string or blank value raises `INVALID_EVENT_PAYLOAD`.
- `jobId` is the canonical correlation key for the timeline.
- `providerJobId` is correlation metadata only and carries no authority. It is
  not unique on its own — see `PHASE_7E_JOB_STATE_MACHINE.md` §2.2.
- `workspaceId` is present for scoping and filtering; it does **not** grant
  access. Authorization is still evaluated through Job -> Project -> Workspace.
- Events carry the **normalized** idempotency key from
  `normalizeIdempotencyKey()`, so duplicate submits correlate to the same Job.
- Every event should carry the attempt number once attempts exist, so redelivered
  provider evidence attaches to the correct attempt rather than the latest one.

## 5. Audit Timeline Ordering

- The timeline is **append-only**. Events are never mutated or deleted; a
  correction is a new `job.reconciled` event.
- Ordering is **per Job**, by a monotonic sequence assigned by the Job Engine at
  append time. Wall-clock timestamps are recorded but must not be the ordering
  key — provider and worker clocks are untrusted.
- Provider-supplied timestamps are stored as provider metadata only.
- Concurrent appends for one Job must be serialized so the sequence is total.
  Across Jobs, no global ordering is required.
- Out-of-order provider evidence (a late webhook for a superseded attempt) is
  appended in arrival order and marked as pertaining to its attempt. It must not
  be reordered to look current, and must not drive a transition that the state
  machine forbids.
- Replaying the timeline in sequence order must reproduce the current Job state.
  WP-7E-04 should treat that as a testable invariant.

## 6. Failure, Cancellation, And Retry Event Semantics

- **Failure.** `job.failed` records the normalized failure class and its
  `JOB_FAILURE_KINDS` mapping (`transient`, `permanent`, `cancelled`,
  `timeout`), the attempt number, whether the retry budget was exhausted, and
  user-safe error text. A retryable failure that schedules another attempt emits
  `job.retried`, **not** `job.failed` — `job.failed` is reserved for the
  terminal outcome.
- **Cancellation.** Cancellation produces at least a request record and a
  finalizing `job.cancelled` event carrying `cancel_requested_at`, the
  requesting actor, and the reason. Because the scaffold has no `cancelling`
  state (decision **D2**), the requested/confirmed distinction lives in event
  metadata. A `CANCEL_FAILED` provider outcome does not by itself produce
  `job.failed`; cancellation policy decides the final state.
- **Late evidence after terminal.** Provider success or failure arriving after a
  terminal state is recorded as `job.reconciled` evidence **only**. It must not
  transition the Job and must not trigger asset registration.
- **Retry.** `job.retried` records the new attempt number, `next_attempt_at`,
  the backoff applied, and the triggering failure class. The Dynaxis Job id is
  unchanged; a new provider job id, when issued, is attached to the new attempt.
- **Reconciliation.** `job.reconciled` records what divergence was found, what
  evidence was consulted, and what decision was taken — including "no change".

## 7. What WP-7E-04 Must Persist

- **Event record:** Job id, monotonic per-Job sequence, event name from the
  closed vocabulary, attempt number, actor kind and actor id, redacted payload,
  validated correlation ids, normalized idempotency key, created-at.
- **Append-only guarantee:** no update or delete path; corrections are new
  events.
- **Uniqueness for redelivery:** enough constraint that a redelivered webhook or
  duplicate queue message does not append a second identical event. Suggested
  binding: Job id + attempt + event name + provider evidence fingerprint.
- **Query paths:** by Job id ordered by sequence (timeline view); by workspace
  and time window (audit view); by `providerJobId` plus provider scope (callback
  correlation).
- **Retention:** must be a stated policy, not an accident of table growth.

## 8. Durable Audit Requirements That Remain Future Work

- **Relationship to Phase 7D residual risk R3.** R3 records that the
  ProviderConnection audit sink is **in-memory and does not survive restart**,
  and that durable audit needs a migration owner. That risk is **not resolved**
  by this specification and is **not** in WP-7E-04's scope: WP-7E-04 owns the
  **Job event timeline**, which is a different boundary from the Phase 7D
  provider-connection audit sink.
  Persisting job events must not be mistaken for closing R3. If a future package
  unifies them, it must claim its own migration owner and must not weaken the
  Phase 7D secret boundary or browser redaction rules.
- Tamper-evidence (hash chaining or signing) is **not** specified here and
  remains future work.
- Export, retention enforcement, and compliance-driven deletion are Phase 10
  concerns (`WP-10-05`, `WP-10-06`), not Phase 7E.
- Cross-domain audit correlation (Jobs plus provider connections plus identity)
  has no owner. It must not be improvised inside WP-7E-04.

## 9. Security Boundary

- Events are evidence, never authority. No event grants a permission.
- `job.read` gates timeline visibility; inheritance is Job -> Project ->
  Workspace.
- Webhook origin verification (WP-7E-07) authenticates the **provider**, not a
  user.
- **Phase 7D residual risk R1 remains binding.**
  `assertWorkerProviderConnectionBlocked()` throws `501` unconditionally and
  `WORKER_PROVIDER_CONNECTION_POLICY.status` is `blocked`. **WP-7E-06 must not
  use ProviderConnections until an explicit, tested service-principal allowlist
  exists.** Emitting or persisting job events does not resolve R1, and no event
  payload may carry ProviderConnection secret material — every relevant key is
  already in `REDACTED_EVENT_PAYLOAD_KEYS`.

## 10. Non-Goals

No queue technology selection (WP-7E-02), no persistence in this document, no
webhook route implementation (WP-7E-07), no worker runtime (WP-7E-06), no
durable Phase 7D audit sink (R3, unowned), no UI, no public API surface.
