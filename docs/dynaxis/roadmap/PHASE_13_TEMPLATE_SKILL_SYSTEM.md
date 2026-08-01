# Phase 13 - Templates, Skills, and Reusable App Packs (Roadmap Scaffold)

> Scaffold only. This file is a planning skeleton and does not indicate that template or skills runtime is implemented.

## 1. Purpose

Unify reusable templates, skill manifests, and app-pack assets into governed, versioned packages that can be discovered, composed, and executed safely.

## 2. What It Builds

- Canonical packaging model for templates/skills/app packs.
- Versioning, compatibility, and dependency declarations.
- Reuse workflows across design/build/agent execution surfaces.

## 3. Dependencies

- `WP-8E-*` skill manifest/runtime baseline.
- `WP-8A-*` app factory registry and App IR contracts.
- `WP-8H-*` marketplace distribution channels.
- Entitlement and policy layers for premium/managed packs.

## 4. Forbidden Shortcuts

- No runtime execution of unverified package artefacts.
- No package model duplication between templates, skills, and app packs.
- No bypass of permission declarations in package manifests.

## 5. Likely Packages

- Unified package specification and compatibility model package.
- Package publishing and version governance package.
- Runtime composition and invocation bridge package.
- Quality gates and verification evidence package.

## 6. Likely Migration Owners

- One owner for package identity/version/dependency schema.
- Additional owner for execution provenance state if required.
- Owner serialization must align with existing skills and marketplace schema lines.

## 7. Likely UI Areas

- Template/skill/app-pack catalogue and install surfaces.
- Package authoring and version publishing views.
- Compatibility diagnostics and dependency conflict UX.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/templates/**`, `skills/**`, `app-packs/**`.
- `lib/dynaxis/skills/**`, `lib/dynaxis/app-factory/**` package services.
- Runtime bridge into orchestration and verification gates.

## 9. Test Strategy

- Package validation and compatibility contract tests.
- Install/upgrade/uninstall and rollback scenario tests.
- Runtime permission-boundary tests for package execution.
- Cross-version migration tests for long-lived projects.

## 10. Security Risks

- Manifest spoofing and dependency confusion.
- Unauthorized skill capability escalation.
- Supply-chain compromise through package updates.
- Data exfiltration via over-permissioned package hooks.

## 11. Parallelisation Notes

- Authoring UX and schema planning can run in parallel.
- Dependency/version persistence should serialize by migration owner.
- Security and compatibility reviews can run in parallel post-manifest freeze.

## 12. What Must Wait for Earlier Phases

- Must wait for `WP-8E-*` skills baseline completion.
- Must wait for App IR and registry stabilization from Phase 8A.
- Must wait for marketplace distribution primitives before broad packaging rollout.
