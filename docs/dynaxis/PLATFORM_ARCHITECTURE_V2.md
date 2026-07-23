# Dynaxis Labs Studios - Platform Architecture V2

**Status:** Canonical architecture after Phase 6I; Phase 7B provider kernel foundation is implemented.
**Scope:** Platform architecture plus implemented Phase 7B provider kernel foundation. No Phase 7C+ runtime implementation.
**Authority:** Current implementation and migrations are authoritative where they differ from older roadmap text.

---

## 1. Purpose

Dynaxis Labs Studios has evolved through four architectural generations:

1. Original Open-Generative-AI / MuAPI creative studio.
2. Dynaxis Phase 1-6I platform foundation.
3. Emerging App Factory / Apps Studio ambition.
4. Provider-neutral Higgsfield-grade creative platform ambition.

V2 consolidates these into one product architecture:

```text
                         DYNAXIS

            DESIGN        BUILD        ENGINEER

              \             |             /
               \            |            /
                    DYNAXIS PROJECT
                          |
                    PROJECT GRAPH
                          |
               KNOWLEDGE + MEMORY
                          |
                 DYNAXIS ORCHESTRATOR
                     /          \
                    /            \
          CREATIVE ENGINE     SOFTWARE ENGINE
                 |                  |
         generation jobs      engineering jobs
                  \                /
                   \              /
                      JOB ENGINE
                          |
               Queue / Events / Audit
                          |
          Capability Router / Worker Router
                     /                    \
                    /                      \
       Provider Adapters              Worker Adapters
       MuAPI / Higgsfield / ...       Codex / Claude / OpenHands / ...
                          |
                Postgres / S3 / GitHub
```

The canonical Dynaxis domain model is owned by Dynaxis. MuAPI, Higgsfield, Fal, Replicate, Figma, Claude, Codex, OpenHands, Cursor, Factory, Devin, and future systems are providers, adapters, registries, or workers.

---

## 2. Implemented Now

### Product surface

- Next.js web shell with Dynaxis navigation and active project context.
- Vite/Electron desktop surface with local inference support.
- `packages/studio` creative studios: image, video, audio, clipping, vibe motion, lip sync, recast, cinema, marketing, workflows, agents, design agent, apps, AI influencer.
- Vibe Workflow and Agent packages preserved as existing operational systems.

### Platform services

- PostgreSQL / Drizzle metadata store.
- Dynaxis Projects with Default Project resolution.
- Asset metadata catalogue and generated media registration.
- Generation history and Job metadata lifecycle.
- Provider kernel foundation: provider-neutral ids, provider contract, provider registry, gateway request/result boundary, provider error taxonomy, and MuAPI adapter compatibility.
- Lifecycle wrapper around current generation calls.
- Asset blob store boundary for rendered creative editor exports: memory, filesystem, S3-compatible.

### Creative platform domains

- Persistent Characters, Products, Brands, Campaigns.
- Compositions and immutable Composition revisions.
- Design Templates and immutable Template revisions.
- Design Components and immutable Component revisions.
- Design Systems, token documents, modes, token bindings.
- Component Sets and sparse variant axes.
- Design Agent as a Composition controller using typed operations, not Konva as document authority.

### Mini App runtime

- Typed Mini App manifest, registry, allowlisted loaders, permissioned runtime, and host executor.
- Integrated Mini Apps: Headshot, Character Studio, Product Studio, Brand Studio, Campaign Studio, Creative Editor, Design Library.
- Apps catalogue remains separate from integrated modules.

---

## 3. Planned

### Project Graph

The existing `dynaxis_projects` domain becomes the central organizing object for all Design, Build, and Engineer work. Future graph edges connect Projects to requirements, App IR revisions, repositories, deployments, engineering work packages, agent memories, provider identities, and verification evidence.

### Creative Engine

Current Generation / Job / Asset infrastructure evolves into a provider-neutral Creative Engine:

- Capability Registry.
- Generation Gateway.
- Provider Registry.
- Provider Connections / Secrets owned by Dynaxis users or organizations.
- Provider adapters for MuAPI, Higgsfield, Fal, Replicate, local inference, and future systems.
- Queue / event / webhook completion.
- Character identity profiles attached to Dynaxis Characters.

The Generation Gateway creates the canonical Dynaxis Generation/Job request before provider dispatch. The Dynaxis Job Engine owns durable execution; provider adapters are downstream.

### Software Engine / App Factory

Build and Engineer modes add production software creation without duplicating existing Project or Asset systems:

- App IR.
- Software Component Registry.
- Software Template / Blueprint Registry.
- Application Capability Registry.
- Repository model.
- Build environments.
- Engineering work packages.
- Verification provenance and software genome.

### Orchestrator

Dynaxis Orchestrator coordinates role-based agents, work packages, memory, permissions, skills, workers, queues, and verification gates. Providers are execution engines, not canonical roles.

V2 separates early Agent / Engineering Contracts from later orchestration runtime. Agent Role, Work Package, Worker Adapter, and Verification Gate contracts are required before App Factory can delegate engineering safely. Full Supercomputer orchestration remains deferred.

---

## 4. Deferred

These are intentionally not implemented by this consolidation:

- Provider Connections / Secrets.
- App IR schema or packages.
- Software registry packages.
- Higgsfield SDK or provider implementation.
- Authentication, organizations, billing, credits ledger.
- Queues, workers, webhooks.
- Auto Layout.
- Skills runtime.
- Supercomputer runtime.
- Production code components.
- Figma / 21st.dev / Aura importers.
- Product UI changes.

---

## 5. Canonical Product Model

Dynaxis has one Project, not separate Design Projects, App Projects, Workflow Projects, and Engineering Projects.

Future Project views:

| View | Responsibility |
|------|----------------|
| Overview | Status, goals, graph summary, activity |
| Design | Compositions, design systems, templates, creative assets |
| Build | App IR, blueprints, software components, application capabilities |
| Code | repositories, branches, worktrees, pull requests |
| Workflows | Vibe Workflow graphs and runs |
| Agents | role agents, conversations, delegated work |
| Assets | generated and uploaded project media/files |
| Deployments | environments, releases, domains |
| Knowledge | requirements, briefs, references, memory |
| History | audit, jobs, decisions, provenance |

Design, Build, and Engineer are capability views of the same Project.

---

## 6. Domain Boundaries

### Creative domains

Existing Design Components are visual composition components. They are used by Compositions, Creative Editor, Campaigns, Design Agent, Templates, Design Systems, and Resvg rendering.

They are not React/code components.

### Software domains

Future Software Components describe production application units such as `SupplierSearchTable`, `AuthenticationForm`, `PricingTable`, `MessagingThread`, or `CheckoutFlow`.

They require their own model: source package, framework compatibility, props schema, behavior, tests, accessibility, API dependencies, permissions, provenance, license, and production usage.

Design Components and Software Components may reference each other later, but must not share one persistence model.

---

## 7. Architectural Conflicts Resolved

| Conflict | V2 resolution |
|----------|---------------|
| MuAPI as foundation vs Dynaxis as platform | MuAPI remains a provider; Dynaxis owns Projects, Jobs, Assets, identity, graph, and orchestration. |
| Apps Studio catalogue vs App Factory | Catalogue is not Build architecture; App Factory gets App IR, registries, repositories, work packages, and verification. |
| Design Components vs code components | Separate domains with separate persistence and lifecycles. |
| Character references vs provider identity | Dynaxis Character remains canonical; provider identities attach as profiles. |
| Agent role vs LLM/coding provider | Dynaxis owns roles and work packages; providers execute. |
| Vibe Workflow vs app builder | Workflow remains pipeline automation, not the whole software architecture system. |
| Auto Layout as next design task vs platform dependency | Auto Layout belongs under Design/Build composition semantics and should wait until V2 boundaries are stable. |

---

## 8. Supersedes Later

This document should become the top-level architecture reference for post-6I planning. Older files remain useful historical records, but `TARGET_ARCHITECTURE.md`, `INTEGRATION_ROADMAP.md`, and `CURRENT_ARCHITECTURE.md` should later point readers here for V2 direction.
