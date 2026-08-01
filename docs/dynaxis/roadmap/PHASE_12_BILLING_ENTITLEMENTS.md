# Phase 12 - Billing, Entitlements, and Quotas (Roadmap Scaffold)

> Scaffold only. This planning document does not implement billing, quota, or commercial ledger behavior.

## 1. Purpose

Define commercial control planes for plans, credits, metering, entitlements, and quota enforcement that remain compatible with Dynaxis identity and canonical domain boundaries.

## 2. What It Builds

- Billing plan and entitlement policy model.
- Metering and usage accounting pipeline.
- Quota and limit enforcement hooks across platform operations.

## 3. Dependencies

- `WP-10-01` billing/credits line in programme catalogue.
- `WP-8F-*` public API identity/developer credential surfaces.
- Marketplace distribution and purchase flows.
- Observability and audit controls for dispute and reconciliation.

## 4. Forbidden Shortcuts

- No hardcoded plan checks scattered across product surfaces.
- No direct mutation of usage counters outside metering authority.
- No bypass of workspace/project ownership when applying entitlements.

## 5. Likely Packages

- Plan and entitlement policy package.
- Usage metering and ledger ingestion package.
- Quota enforcement middleware/package-level policy hooks.
- Reconciliation/refund/dispute handling package.

## 6. Likely Migration Owners

- Primary owner for billing ledger and entitlement schema line.
- Secondary owner for quota snapshots if separated for scale.
- Migration serialization required against other commercial schema owners.

## 7. Likely UI Areas

- Workspace billing dashboard and plan controls.
- Usage and quota visibility in project/studio contexts.
- Admin support surfaces for adjustments and dispute workflows.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/billing/**`, `app/api/dynaxis/entitlements/**`.
- `lib/dynaxis/billing/**` metering, ledger, and entitlement services.
- Runtime quota guards in job/deployment/marketplace execution points.

## 9. Test Strategy

- Metering correctness tests across operation categories.
- Entitlement policy tests for allow/deny and downgrade paths.
- Quota enforcement and race-condition tests under concurrency.
- Reconciliation and recovery tests for delayed provider events.

## 10. Security Risks

- Fraud via replayed usage events or tampered counters.
- Privilege escalation through entitlement projection bugs.
- Sensitive financial metadata leakage in UI/API projections.
- Denial-of-service from quota-check hot paths.

## 11. Parallelisation Notes

- Policy design and UI visibility can run in parallel.
- Ledger/metering persistence requires single migration-owner serialization.
- API/SDK exposure should follow core policy contract stabilization.

## 12. What Must Wait for Earlier Phases

- Must wait for stable identity/permissions and developer platform boundaries.
- Must wait for marketplace purchase/distribution handshake design.
- Must wait for observability/audit baselines before production charging enforcement.
