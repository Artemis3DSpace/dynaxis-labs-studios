# Dynaxis Jobs Scaffold (Phase 7E)

This directory now contains scaffold contracts plus WP-7E-04 persistence modules
for job and job-event storage.

## Included

- Canonical job states and transition rules
- Terminal-state semantics
- Retry/cancellation/timeout classification helpers
- Event names and event creation helpers
- Event payload redaction helpers
- Idempotency key normalization contract
- Correlation id contract
- Explicit worker/ProviderConnection dispatch boundary blocker
- Persistence schema and mapping helpers (`WP-7E-04`)
- In-memory persistence store for boundary-focused tests (`WP-7E-04`)

## Excluded (intentional)

- No queue implementation or dispatcher loop (`WP-7E-05` owns this later)
- No worker runtime (`WP-7E-06` owns this later)
- No webhooks
- No queue dispatch implementation, provider adapter implementation, or OAuth

## ProviderConnection Worker Boundary

The scaffold intentionally blocks ProviderConnection use from worker dispatch.
`assertWorkerProviderConnectionBlocked()` throws until an explicit, tested
service-principal allowlist exists for worker access.

This guard protects current Phase 7D boundaries and prevents implicit worker
credential use before authorization policy is defined and tested.

