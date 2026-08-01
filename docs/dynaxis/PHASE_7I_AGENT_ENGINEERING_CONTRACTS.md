# Phase 7I - Agent / Engineering Contracts Domain Scaffold

## Status

This scaffold introduces pure domain contracts for Phase 7I (WP-7I-01 scope).
It defines role/runtime/verification contract helpers only.

It does not implement worker execution, orchestration runtime, persistence, or
capability-routing behavior.

## Contract Surface

`lib/dynaxis/agents/` defines:

- `roles.js`: agent role names and allowed action categories.
- `work-package-contracts.js`: work-package runtime contract validation.
- `verification-contracts.js`: verification gate and execution result contracts.
- `index.js`: public scaffold exports.

## Core Vocabulary

- Agent role names: planner, implementer, reviewer, verifier, release manager,
  observer.
- Action categories: plan/read/write/test/verify/report.
- Work-package runtime contract: requires id, phase, title, and type.
- Verification result contract: `pass`, `fail`, `blocker`.
- Execution result contract: queued/running/completed/failed/blocked.

## Invariants

- Work-package contracts fail validation when id/phase/title/type are missing.
- Verification contracts enforce pass/fail/blocker status vocabulary.
- Execution result contracts enforce known runtime result statuses.
- Assigned role (when provided) must be a known agent role.

## Non-goals

- No WP-7I-02 runtime implementation.
- No worker adapter implementation (WP-7I-03).
- No verification execution engine (WP-7I-04).
