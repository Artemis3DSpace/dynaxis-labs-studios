# Dynaxis Labs Studios - Roadmap V2

**Status:** Proposed post-6I roadmap.  
**Rule:** Phases 1-6I are completed historical implementation. Do not rewrite them.

---

## 1. Completed Baseline

Dynaxis is currently implemented through Phase 6I:

- Phase 1: repository audit and architecture baseline.
- Phase 2: Dynaxis branding and platform shell.
- Phase 3: Projects, Assets, Generations, Jobs, MuAPI lifecycle facade.
- Phase 4: Mini App framework.
- Phase 5A-5E: Headshot, Character, Character reuse, runtime hardening, Lip Sync.
- Phase 6A-6I: Product, Marketing integration, Brand, Campaign, Creative Editor, production export closure, Design Library, Design Agent bridge, Design Components, Design Systems, Component Sets.

---

## 2. Proposed Phase Order

```text
Phase 7A  Architecture consolidation
  -> Phase 7B  Generation provider kernel
    -> Phase 7C  Server job/event engine
      -> Phase 7D  Dynaxis identity / organizations / permissions
        -> Phase 7E  Expanded Project Graph
          -> Phase 7F  Capability/model registry
            -> Phase 7G  Character identity profiles
              -> Phase 8A  App Factory core
                -> Phase 8B  Build runtime
                  -> Phase 8C  Composer / Auto Layout
                    -> Phase 8D  Skills
                      -> Phase 9  Agent orchestration / Supercomputer
```

Numbering can be adjusted, but dependency order should not be inverted without a deliberate architecture decision.

---

## 3. Phase 7A - Architecture Consolidation

**Status:** This documentation task.

Deliverables:

- `PLATFORM_ARCHITECTURE_V2.md`
- `APP_FACTORY_ARCHITECTURE.md`
- `GENERATION_PLATFORM_ARCHITECTURE.md`
- `AGENT_ORCHESTRATION_ARCHITECTURE.md`
- `PROJECT_GRAPH_ARCHITECTURE.md`
- `ROADMAP_V2.md`

No runtime behavior changes.

---

## 4. Phase 7B - Generation Provider Kernel

Goal: make creative generation provider-neutral while preserving MuAPI.

Depends on:

- V2 architecture.
- Existing Generation / Job / Asset lifecycle.

Deliverables:

- Capability Registry contract.
- Provider Registry contract.
- Generation Gateway contract.
- MuAPI adapter moved behind gateway.
- Provider-neutral request/result/error taxonomy.

Not included:

- Higgsfield implementation unless explicitly scoped.
- Billing.
- queues/workers unless deferred to 7C.

---

## 5. Phase 7C - Server Job/Event Engine

Goal: server-owned asynchronous execution.

Depends on:

- Generation Gateway.

Deliverables:

- Queue selection.
- Worker lifecycle.
- Retry/cancel/timeout policy.
- Webhook receiver boundary.
- Event/audit timeline.

This should replace client-primary polling as the long-term execution authority without breaking existing studios.

---

## 6. Phase 7D - Dynaxis Identity / Organizations / Permissions

Goal: move beyond MuAPI key ownership hashes.

Depends on:

- Stable platform service boundaries.
- Job/event policy for user actions.

Deliverables:

- User identity.
- Organizations/workspaces.
- Project membership.
- API keys/secrets model.
- RBAC/ABAC permissions.

Avoid coupling identity to one provider account.

---

## 7. Phase 7E - Expanded Project Graph

Goal: evolve Project from container into graph backbone.

Depends on:

- Identity/permissions.
- Current domain tables.

Deliverables:

- Typed graph edges.
- Project Graph query API.
- Memory/knowledge records.
- Decision/audit records.

Do not replace current domain tables.

---

## 8. Phase 7F - Capability / Model Registry

Goal: central capability and model metadata.

Depends on:

- Provider Kernel.
- Project Graph for provenance.

Deliverables:

- Dynaxis-managed model/capability records.
- Cost/latency/quality metadata.
- Capability matching.
- Provider model mapping.
- Entitlement hooks.

Seed from `packages/studio/src/models.js`, then make it governed.

---

## 9. Phase 7G - Character Identity Profiles

Goal: attach provider identity systems to Dynaxis Characters.

Depends on:

- Provider Registry.
- Character domain.
- Project Graph.

Deliverables:

- Identity profile model.
- Dynaxis reference identity profile.
- Provider identity attachments such as Higgsfield Soul ID.
- Provenance and consent rules.

Soul ID remains a provider profile, not the Character entity.

---

## 10. Phase 8A - App Factory Core

Goal: first canonical Build architecture.

Depends on:

- Project Graph.
- Identity/permissions.
- Agent work package contract.

Deliverables:

- App IR contract.
- Software Component Registry contract.
- Software Blueprint Registry contract.
- Application Capability Registry contract.
- Repository model contract.

This is architecture/code foundation, not a duplicate Apps Studio.

---

## 11. Phase 8B - Build Runtime

Goal: turn Build briefs into verified engineering work packages.

Depends on:

- App Factory Core.
- Agent orchestration basics.
- Repository model.

Deliverables:

- Requirements-to-spec flow.
- Blueprint selection.
- Software component selection.
- Work package generation.
- Verification plan generation.

---

## 12. Phase 8C - Composer / Auto Layout

Goal: unify responsive design behavior across creative and app creation.

Depends on:

- Design Systems / Components from Phase 6I.
- App IR layout requirements.
- Build architecture boundaries.

Auto Layout remains necessary, but it should be implemented where it serves both Design and Build semantics rather than as an isolated canvas feature.

---

## 13. Phase 8D - Skills

Goal: reusable capability packages callable by agents, workflows, and users.

Depends on:

- Capability Registry.
- Work packages.
- Permissions.
- Job/event engine.

Mini App capability summaries can seed this, but they are not a Skills runtime today.

---

## 14. Phase 9 - Agent Orchestration / Supercomputer

Goal: high-order orchestration across Projects, workflows, skills, workers, providers, and verification gates.

Depends on:

- Project Graph.
- Skills.
- Worker adapters.
- Work packages.
- Verification gates.
- Job/event engine.

Supercomputer should coordinate the platform. It must not become a separate product model or bypass Project ownership.

---

## 15. Deliberately Not Started

- Phase 6J implementation.
- Provider kernel.
- App Factory code.
- Higgsfield.
- Skills.
- Supercomputer.
- Auto Layout.
- Identity/organizations.
- Queues/workers.
- UI changes.
