# Phase 11 - Marketplace and Distribution (Roadmap Scaffold)

> Scaffold only. This roadmap structure is not a declaration of implemented marketplace runtime.

## 1. Purpose

Evolve marketplace from catalogue features into governed distribution infrastructure for templates, skills, plugins, and other canonical Dynaxis objects.

## 2. What It Builds

- Distribution lifecycle for publish/review/version/promote/deprecate flows.
- Trust, verification, and provenance policies for distributed artefacts.
- Controlled installation/update channels linked to entitlement policy.

## 3. Dependencies

- `WP-8G-*` plugin integrity/runtime foundation.
- `WP-8H-*` marketplace baseline and governance review.
- `WP-8F-*` developer platform publication surfaces.
- Billing/entitlement prerequisites from later commercial phases.

## 4. Forbidden Shortcuts

- No side-loading bypass around signing, compatibility, or policy checks.
- No direct runtime injection from marketplace payloads.
- No duplicate object models outside canonical registries.

## 5. Likely Packages

- Publisher and package trust policy package.
- Version/channel and distribution routing package.
- Installation orchestration and rollback package.
- Moderation/reporting/enforcement package.

## 6. Likely Migration Owners

- One owner for package/version distribution metadata.
- One owner for installation and channel state if separated.
- Ownership must serialize with commercial entitlement migration lines.

## 7. Likely UI Areas

- Marketplace publisher console and package release controls.
- Consumer install/update/license status surfaces.
- Trust badges, moderation reports, and policy action panels.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/marketplace/**` distribution routes.
- `lib/dynaxis/marketplace/**` package and policy services.
- Runtime integration with plugin/template/skill installers.

## 9. Test Strategy

- Package publish-to-install lifecycle tests.
- Compatibility matrix tests across version/channel combinations.
- Policy enforcement tests (rejection, suspension, takedown).
- Rollback/recovery tests for failed upgrade paths.

## 10. Security Risks

- Malicious package payloads and dependency poisoning.
- Signature bypass or downgrade attacks.
- Unauthorized publisher impersonation.
- Entitlement bypass for private or paid packages.

## 11. Parallelisation Notes

- Publisher UX and moderation tooling can be parallelized.
- Distribution persistence and install lifecycle state should serialize by owner.
- Security review can proceed in parallel after manifest/signature contracts settle.

## 12. What Must Wait for Earlier Phases

- Must wait for plugin/runtime governance maturity from Phase 8G/8H.
- Must wait for entitlement and billing policy in commercial phases.
- Must wait for deployment/runtime controls where distributed runtime effects exist.
