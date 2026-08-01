# Phase 10 - Deployment Runtime and Preview Environments (Roadmap Scaffold)

> Scaffold only. This is planning structure for future Work Packages and does not indicate implemented deployment runtime behavior.

## 1. Purpose

Define a governed deployment runtime that can build, release, and validate project outputs in preview and production-like environments with strict rollback and verification controls.

## 2. What It Builds

- Deployment domain model for environment lifecycle and release state.
- Preview environment orchestration linked to Build/Engineer outputs.
- Progressive rollout, rollback, and release verification controls.

## 3. Dependencies

- `WP-8A-*` App Factory contract line.
- `WP-8B-*` Build runtime and verification flow.
- `WP-8F-*` Developer platform API/SDK/webhook surfaces.
- `WP-10-*` production hardening baseline from current programme line.

## 4. Forbidden Shortcuts

- No direct environment mutation outside governed deployment services.
- No release without verification evidence and rollback metadata.
- No conflation of creative job runtime with software deployment runtime.

## 5. Likely Packages

- Environment registry and release model package.
- Preview environment provisioning and lifecycle package.
- Rollout strategy + rollback package.
- Deployment verification and incident handoff package.

## 6. Likely Migration Owners

- One migration owner for deployment environment schema line.
- Separate owner for release event/audit persistence if split is required.
- Migration ownership must remain serialized against other active production owners.

## 7. Likely UI Areas

- Project deployment dashboard and environment health cards.
- Release timeline, diff, rollback, and verification result panels.
- Preview environment links and guardrailed promotion actions.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/deployments/**` and environment routes.
- `lib/dynaxis/deployments/**` release coordination services.
- Worker/runtime adapters for build artifact deploy execution.

## 9. Test Strategy

- End-to-end preview-to-promotion flow tests.
- Failure injection for partial rollout and rollback integrity.
- Drift detection tests for release metadata and environment state.
- Access-control tests for promotion and destructive actions.

## 10. Security Risks

- Unauthorized promotions or rollback sabotage.
- Supply-chain risk in artifact provenance and deployment hooks.
- Secret exposure through environment diagnostics/log projections.
- Cross-tenant environment boundary leakage.

## 11. Parallelisation Notes

- UI planning and API contract design can proceed in parallel.
- Runtime provisioning and release persistence should serialize by owner.
- Observability instrumentation can run in parallel after core contracts lock.

## 12. What Must Wait for Earlier Phases

- Must wait for stable App IR/build outputs from Phase 8A and 8B.
- Must wait for developer-facing contract stability from Phase 8F.
- Must align with production hardening controls before production-grade rollout.
