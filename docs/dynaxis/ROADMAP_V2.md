# Dynaxis Labs Studios - Roadmap V2

**Status:** Post-6I roadmap. Phase 7B provider kernel foundation is implemented.
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
    -> Phase 7C  Dynaxis identity / organizations / permissions
      -> Phase 7D  Provider connections / secrets
        -> Phase 7E  Server job/event engine
          -> Phase 7F  Expanded Project Graph + memory foundation
            -> Phase 7G  Capability/model registry
              -> Phase 7H  Character identity profiles
                -> Phase 7I  Agent / engineering contracts
                  -> Phase 8A  App Factory core
                    -> Phase 8B  Build runtime
                      -> Phase 8C  Composer
                        -> Phase 8D  Design / Auto Layout / responsive application design
                          -> Phase 8E  Skills
                            -> Phase 9  Agent orchestration / Supercomputer
```

Numbering can be adjusted, but dependency order should not be inverted without a deliberate architecture decision.

---

## 3. Phase 7A - Architecture Consolidation

**Status:** Done.

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

**Status:** Done in foundation form.

Goal: make creative generation provider-neutral while preserving MuAPI.

Depends on:

- V2 architecture.
- Existing Generation / Job / Asset lifecycle.

Deliverables:

- Capability contract.
- Provider Registry contract.
- Generation Gateway contract.
- MuAPI adapter moved behind gateway.
- Provider-neutral request/result/error taxonomy.
- Lifecycle provider normalization and invariant checks between Generation and Job records.

Not included:

- Higgsfield implementation unless explicitly scoped.
- Billing.
- Provider Connections / Secrets.
- Durable queues/workers/webhooks, deferred to 7E.
- Governed Capability / Model Registry database, deferred to 7G.

---

## 5. Phase 7C - Dynaxis Identity / Organizations / Permissions

Goal: move beyond MuAPI key ownership hashes.

Depends on:

- Stable platform service boundaries.
- Generation Provider Kernel contracts.

Deliverables:

- User identity.
- Organizations/workspaces.
- Project membership.
- API keys and session model.
- RBAC/ABAC permissions.

Avoid coupling identity to one provider account.

---

## 6. Phase 7D - Provider Connections / Secrets

Goal: model provider credentials as connections owned by a Dynaxis user or organization.

Depends on:

- Identity/organizations/permissions.
- Provider Registry contract.

Deliverables:

- Provider Connection domain contract.
- Secret storage boundary.
- Connection ownership and permission rules.
- Provider account metadata without treating a provider API key as user identity.
- Future connection types such as MuAPI, Higgsfield, Fal, Replicate, and local/private providers.

Do not implement provider connections in the architecture consolidation branch.

---

## 7. Phase 7E - Server Job/Event Engine

Goal: server-owned asynchronous execution.

Depends on:

- Generation Gateway.
- Identity/permissions.
- Provider Connections / Secrets.

Deliverables:

- Queue selection.
- Worker lifecycle.
- Retry/cancel/timeout policy.
- Webhook receiver boundary.
- Event/audit timeline.
- Idempotency and cancellation policy.

This should replace client-primary polling as the long-term execution authority without breaking existing studios.

---

## 8. Phase 7F - Expanded Project Graph + Memory Foundation

Goal: evolve Project from container into graph backbone.

Depends on:

- Identity/permissions.
- Server job/event audit events.
- Current domain tables.

Deliverables:

- Typed graph edges.
- Project Graph query API.
- Memory/knowledge records.
- Decision/audit records.

Do not replace current domain tables.

---

## 9. Phase 7G - Capability / Model Registry

Goal: central capability and model metadata.

Depends on:

- Provider Kernel.
- Project Graph for provenance.
- Provider Connections for credential-aware availability.

Deliverables:

- Dynaxis-managed model/capability records.
- Cost/latency/quality metadata.
- Capability matching.
- Provider model mapping.
- Entitlement hooks.

Seed from `packages/studio/src/models.js`, then make it governed.

---

## 10. Phase 7H - Character Identity Profiles

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

## 11. Phase 7I - Agent / Engineering Contracts

Goal: define the safe delegation contracts required before App Factory creates engineering work.

Depends on:

- Identity/permissions.
- Project Graph + memory foundation.
- Server job/event engine.

Deliverables:

- Agent Role contract.
- Engineering Work Package contract.
- Worker Adapter contract.
- Verification Gate contract.

Not included:

- Supercomputer.
- Skills runtime.
- autonomous multi-agent scheduling.
- provider-specific worker integrations.
- memory-driven planning runtime.

This is a contract foundation only. Full orchestration remains Phase 9.

---

## 12. Phase 8A - App Factory Core

Goal: first canonical Build architecture.

Depends on:

- Project Graph.
- Identity/permissions.
- Provider-independent job/event infrastructure where relevant.
- Agent / Engineering Contracts.

Deliverables:

- App IR contract.
- Software Component Registry contract.
- Software Blueprint Registry contract.
- Application Capability Registry contract.
- Repository model contract.

This is architecture/code foundation, not a duplicate Apps Studio.

---

## 13. Phase 8B - Build Runtime

Goal: turn Build briefs into verified engineering work packages.

Depends on:

- App Factory Core.
- Agent / Engineering Contracts.
- Repository model.

Deliverables:

- Requirements-to-spec flow.
- Blueprint selection.
- Software component selection.
- Work package generation.
- Verification plan generation.

---

## 14. Phase 8C - Composer

Goal: create the future media/timeline composition environment influenced by Pixovid-style architecture.

Depends on:

- Existing Composition / Asset / Generation domains.
- Server job/event engine.
- Project Graph.
- Capability/model registry.

Deliverables:

- Video tracks.
- Audio tracks.
- Generated clips.
- Images and text.
- Effects.
- Markers.
- Transitions.
- Timeline composition.
- Render graph.

Composer is not Auto Layout.

---

## 15. Phase 8D - Design / Auto Layout / Responsive Application Design

Goal: add responsive design and application layout semantics for Design and App Factory.

Depends on:

- Design Systems / Components from Phase 6I.
- App Factory Core.
- App IR layout requirements.
- Build architecture boundaries.

Deliverables:

- Layout stacks.
- Constraints.
- Responsive states.
- Breakpoints.
- Component layout.
- Application visual design semantics.

Auto Layout remains necessary, but it belongs primarily to Design/App Factory semantics, not the media Composer.

---

## 16. Phase 8E - Skills

Goal: reusable capability packages callable by agents, workflows, and users.

Depends on:

- Capability Registry.
- Work packages.
- Permissions.
- Job/event engine.
- Agent / Engineering Contracts.

Mini App capability summaries can seed this, but they are not a Skills runtime today.

---

## 17. Phase 9 - Agent Orchestration / Supercomputer

Goal: high-order orchestration across Projects, workflows, skills, workers, providers, and verification gates.

Depends on:

- Project Graph.
- Skills.
- Worker adapters.
- Work packages.
- Verification gates.
- Job/event engine.
- memory-driven planning foundation.

Supercomputer should coordinate the platform. It must not become a separate product model or bypass Project ownership.

---

## 18. Deliberately Not Started

- Phase 7C+ runtime implementation.
- Provider connections.
- App Factory code.
- Higgsfield.
- Skills.
- Supercomputer.
- Auto Layout.
- Identity/organizations.
- Queues/workers.
- UI changes.
