# Phase 21 - Agent OS and Automation (Roadmap Scaffold)

> Scaffold only. This document is a structured roadmap placeholder and does not implement Agent OS runtime.

## 1. Purpose

Define a coherent Agent OS layer for policy-governed automation, reusable agent workflows, and lifecycle management across multi-step platform operations.

## 2. What It Builds

- Agent OS control contracts for automation policies and execution classes.
- Lifecycle management for autonomous, semi-autonomous, and supervised modes.
- Reusable automation blueprints tied to work packages and verification gates.

## 3. Dependencies

- Supercomputer orchestration foundations (Phase 09).
- Skills/templates/app-pack foundations (Phase 13).
- Collaboration/governance controls (Phases 16 and 18).
- Observability/security/compliance controls (Phases 15 and 17).

## 4. Forbidden Shortcuts

- No autonomous execution without policy and verification guardrails.
- No agent workflow that bypasses work-package contracts.
- No unbounded tool/runtime permissions in automation policies.

## 5. Likely Packages

- Agent OS policy and lifecycle contract package.
- Automation blueprint and execution runtime package.
- Supervision/override/recovery controls package.
- Evidence/provenance integration package.

## 6. Likely Migration Owners

- Owner for automation policy/state persistence line.
- Owner for long-running automation execution metadata if separated.
- Serialization required with orchestration and governance persistence owners.

## 7. Likely UI Areas

- Agent OS control center and automation catalog.
- Execution timeline, supervision, and intervention interfaces.
- Policy guardrail and approval workflow panels.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/agent-os/**`, `automation/**`.
- `lib/dynaxis/agent-os/**`, orchestration bridges.
- Runtime execution coordinator integrating jobs, skills, and gates.

## 9. Test Strategy

- Policy enforcement tests for automation mode boundaries.
- Multi-step execution tests with interruption/recovery semantics.
- Determinism and reproducibility tests for automation blueprints.
- Security tests for scoped tool access and context isolation.

## 10. Security Risks

- Runaway automation loops causing uncontrolled mutations/cost.
- Privilege creep across chained automations.
- Traceability gaps in delegated and nested workflows.
- Prompt/tool injection vectors in automation inputs.

## 11. Parallelisation Notes

- UX/policy modelling can run in parallel with blueprint catalog work.
- Execution-state persistence and lifecycle runtime should serialize by owner.
- Security and reliability hardening can parallelize after policy contracts freeze.

## 12. What Must Wait for Earlier Phases

- Must wait for Phase 09 orchestration contracts and skills maturity.
- Must wait for governance, compliance, and observability controls.
- Must wait for collaboration workflows where automation delegates to humans.
