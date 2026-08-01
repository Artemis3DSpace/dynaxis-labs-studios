# Dynaxis Jobs Scaffold (Phase 7E)

This directory provides scaffold-only contracts for Phase 7E Job/Event Engine work.

## Included

- Canonical job states and transition rules
- Terminal-state semantics
- Retry/cancellation/timeout classification helpers
- Event names and event creation helpers
- Event payload redaction helpers
- Idempotency key normalization contract
- Correlation id contract
- Explicit worker/ProviderConnection dispatch boundary blocker

## Excluded (intentional)

- No database persistence (`WP-7E-04` owns this later)
- No queue implementation or dispatcher loop (`WP-7E-05` owns this later)
- No worker runtime (`WP-7E-06` owns this later)
- No webhooks
- No schema/migration changes

## ProviderConnection Worker Boundary

The scaffold intentionally blocks ProviderConnection use from worker dispatch.
`assertWorkerProviderConnectionBlocked()` throws until an explicit, tested
service-principal allowlist exists for worker access.

This guard protects current Phase 7D boundaries and prevents implicit worker
credential use before authorization policy is defined and tested.

