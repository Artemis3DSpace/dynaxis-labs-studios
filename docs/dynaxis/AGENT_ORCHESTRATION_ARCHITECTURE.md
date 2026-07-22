# Dynaxis Labs Studios - Agent Orchestration Architecture

**Status:** Planned architecture. Current Agents and Design Agent remain preserved.  
**Scope:** Distinguishes early contract foundation from later orchestration runtime.

---

## 1. Principle

Provider is not role.

Dynaxis owns agent roles, permissions, memory, context, work packages, skills, and verification gates. Claude, Codex, OpenHands, Cursor, Factory, Devin, and future engines are execution providers or worker adapters.

---

## 2. Implemented Now

- Agent Studio and `/agents` routes via the existing Open-Poe-AI package.
- Design Agent Studio rebuilt as a Dynaxis Composition controller using typed operations.
- `lib/dynaxis/design-agent/*` operation protocol, context builders, server service, and API route.
- Vibe Workflow preserved as workflow/pipeline system.
- Mini App capability summaries intended for future headless invocation.

Not implemented now:

- Dynaxis role registry.
- Worker registry.
- Skills runtime.
- Supercomputer.
- Cross-agent work packages.
- Agent memory service.
- Verification gates beyond current tests/domain validation.

---

## 3. Early Contract Foundation

The early foundation defines contracts only. It does not implement Supercomputer, Skills, autonomous agents, memory-driven planning, worker scheduling, or provider-specific worker integrations.

### AgentRole contract

Defines a canonical Dynaxis role independent of provider:

- role id and purpose;
- permissions;
- allowed Project Graph context;
- allowed tools and future skills;
- expected inputs and outputs;
- review requirements;
- verification responsibilities.

### WorkPackage contract

Defines a scoped unit of delegated engineering or design/build work:

- objective;
- scope;
- Project Graph inputs;
- target repository/worktree if any;
- App IR or Composition delta;
- allowed tools/providers;
- acceptance criteria;
- verification plan;
- dependencies;
- review gates;
- audit trail.

### WorkerAdapter contract

Defines how Dynaxis can later hand a Work Package to a provider-specific worker:

- provider id;
- capabilities;
- required credentials/connection;
- input envelope;
- status/progress reporting;
- artifact reporting;
- command/test evidence;
- cancellation and timeout semantics.

### VerificationGate contract

Defines how completed work is accepted or rejected:

- gate id and type;
- required evidence;
- automated or human review mode;
- blocking/non-blocking severity;
- artifact references;
- result status;
- software genome reliability impact where relevant.

Build and Engineer modes depend on these contracts before production software generation can be safe.

---

## 4. Later Orchestration Runtime

The later runtime provides:

- worker scheduling;
- multi-agent coordination;
- Skills execution;
- memory-driven planning;
- high-order orchestration;
- Supercomputer.

This runtime depends on the early contracts, Project Graph, identity/permissions, Provider Connections, and Job/Event infrastructure.

---

## 5. Planned Role Model

Canonical Dynaxis roles include:

- Product Agent;
- Architect Agent;
- Design Agent;
- Frontend Engineer;
- Backend Engineer;
- Database Engineer;
- Test Engineer;
- Security Reviewer;
- Deployment Engineer.

Each role receives:

- Project Graph context;
- scoped memory;
- permissions;
- allowed tools and skills;
- work-package contract;
- verification requirements;
- audit logging.

The provider chosen to execute a role is an implementation detail.

---

## 6. Memory and Context

### Implemented now

Project context is published to studios and lifecycle APIs. Design Agent receives controlled Composition, Asset, Brand, Product, Character, Campaign, Template, Component, Design System, and Component Set context.

### Planned

Agent memory should include:

- Project memory;
- domain memory;
- conversation memory;
- decision records;
- requirements and constraints;
- verified component/blueprint knowledge;
- provider execution traces;
- user preference and organization policy.

Memory must be scoped by Project, owner/org, permissions, and role. It is not freeform provider chat history.

---

## 7. Worker Adapters

Worker adapters eventually translate Dynaxis work packages into provider execution:

| Adapter | Role |
|---------|------|
| Codex | repository edits, tests, worktrees, code review |
| Claude | planning, reasoning, code or document assistance |
| OpenHands | engineering execution |
| Cursor | local IDE-assisted development |
| Factory / Devin | autonomous engineering execution |
| Future engines | specialized execution |

Adapters report status, artifacts, files changed, commands run, tests, and verification evidence back to Dynaxis. They must not own the Project Graph.

The early foundation defines the adapter contract only. Provider-specific integrations are later work.

---

## 8. Skills Relationship

Skills are reusable capability packages. They may call creative generation, inspect Project Graph context, run engineering actions, or operate domain tools.

Planned rule:

```text
Agent Role -> Work Package -> Allowed Skills -> Worker Adapter -> Verification Gate
```

Skills are not implemented in Phase 6I and must not be assumed available. Mini App `capabilitySummary` fields are seeds for later Skills, not a runtime.

---

## 9. Work Packages

Work packages are the unit of delegated action:

- objective;
- scope;
- Project Graph inputs;
- target repository/worktree if any;
- App IR or Composition delta;
- allowed tools/providers;
- acceptance criteria;
- verification plan;
- dependencies;
- review gates;
- audit trail.

Build and Engineer modes depend on this contract before production software generation can be safe.

---

## 10. Verification Gates

Verification gates should be role-specific:

- architecture review;
- type/schema validation;
- unit/integration/e2e tests;
- accessibility checks;
- visual regression;
- security review;
- deployment smoke;
- provenance completeness.

For App Factory, gates also update software genome reliability levels.

---

## 11. Supercomputer Relationship

Supercomputer is a later orchestration layer across roles, workers, workflows, skills, and Project Graph memory.

It should coordinate many work packages, not replace the core domain model. It depends on:

1. Project Graph.
2. Work package contract.
3. Worker adapters.
4. Skills runtime.
5. Job/event engine.
6. Verification gates.

It is deferred to Phase 9 and is not part of the Phase 7I Agent / Engineering Contracts foundation.

---

## 12. Deferred

- Role registry implementation.
- Memory service implementation.
- Worker adapters.
- Skills runtime.
- Supercomputer.
- Build work packages.
- Verification gate service.
- Provider-specific agent bindings.
