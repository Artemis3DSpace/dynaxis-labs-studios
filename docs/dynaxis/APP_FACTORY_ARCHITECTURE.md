# Dynaxis Labs Studios - App Factory Architecture

**Status:** Planned architecture. Not implemented.  
**Depends on:** Platform Architecture V2, Dynaxis identity/permissions, provider-independent Job/Event infrastructure where relevant, Project Graph, Agent / Engineering Contracts.

---

## 1. Boundary

App Factory is Dynaxis Build mode: the production software creation engine inside a Dynaxis Project.

It is not the current Apps Studio catalogue, not a folder of cloned SaaS templates, and not a React-only generator.

```text
Project
  -> Build brief / requirements
  -> Software Blueprint
  -> App IR
  -> Software Components
  -> Engineering Work Packages
  -> Repository / branch / worktree
  -> Verification
  -> Deployment
```

---

## 2. Implemented Now

- Apps Studio catalogue UI with external template cards and interest capture.
- Mini App runtime for internal creative/domain modules.
- Existing Project, Asset, Generation, Job, Character, Product, Brand, Campaign, Composition, Template, Design Component, Design System domains.
- Workflow Studio and Agent Studio as preserved operational systems.

None of the following exists yet: App IR, software component registry, blueprint registry, repository model, build environments, engineering work packages, or software verification provenance.

---

## 3. Planned Concepts

### App IR

App IR is the framework-neutral intermediate representation of a production application. It must describe:

- application identity;
- blueprint/template revision;
- pages/routes;
- layouts;
- production component instances;
- software component versions;
- data sources;
- APIs;
- domain capabilities;
- workflows;
- actions;
- roles and permissions;
- integrations;
- design-system references;
- deployment targets;
- metadata and provenance.

App IR must not embed React as the canonical representation. React, Next.js, mobile, or other frameworks are targets/adapters.

### Software Component Registry

Software Components are production code components, not Dynaxis Design Components.

A Software Component may include:

- semantic version;
- source package/import;
- framework compatibility;
- props/config schema;
- behavior contract;
- test coverage;
- Storybook/example representation;
- accessibility status;
- responsive behavior;
- dependencies and API dependencies;
- permission requirements;
- visual regression evidence;
- provenance, license, and production usage.

### Software Template / Blueprint Registry

Blueprints are verified application patterns: marketplace, booking system, CRM, internal dashboard, content platform, ecommerce, agent portal, and similar product structures.

A Blueprint defines:

- domain capabilities;
- App IR skeleton;
- required Software Components;
- data model expectations;
- integration points;
- security and tenancy assumptions;
- verification requirements;
- deployment compatibility.

### Application Capability Registry

Capabilities are domain-level functions an application can provide, such as authentication, supplier search, payments, messaging, file upload, content publishing, user management, analytics, or scheduling.

Capabilities are not UI components. They map to App IR nodes, Software Components, APIs, workflows, permissions, and verification gates.

### Repository Model

App Factory must track repositories as Dynaxis Project graph nodes:

- provider: GitHub or future Git providers;
- repository URL and default branch;
- worktrees/branches;
- generated source provenance;
- PRs, checks, commits;
- deployment connections;
- code ownership and review state.

### Build / Engineering Work Packages

Work packages are scoped engineering tasks assigned to role agents or human developers.

They carry:

- objective and acceptance criteria;
- App IR delta;
- files/repos affected;
- permissions;
- verification plan;
- dependencies;
- status and audit log.

---

## 4. Verification Levels

Canonical reliability progression:

```text
EXPERIMENTAL
GENERATED
TESTED
PRODUCTION
DYNAXIS_VERIFIED
```

Architectural rule:

Never generate a replacement for a compatible `DYNAXIS_VERIFIED` Software Component when one already exists unless the user explicitly requests replacement.

Dynaxis should increasingly generate exceptions, adapters, and project-specific composition around verified foundations. This is the Dynaxis software genome.

---

## 5. Design / Build / Engineer Relationship

| Mode | App Factory relationship |
|------|--------------------------|
| Design | Supplies visual direction, Design Systems, Composition artifacts, interaction intent, and eventual design-to-App IR references. |
| Build | Converts product requirements into App IR, blueprint selection, software component selection, work packages, and deployment plans. |
| Engineer | Executes, reviews, tests, observes, and deploys source repositories based on Build intent. |

All three modes operate on the same Project Graph.

---

## 6. Deferred

- App IR schema or migrations.
- Software Component Registry code.
- Blueprint Registry code.
- Application Capability Registry code.
- Repository APIs.
- Build environments.
- Verification service.
- Source generation.
- Auto Layout implementation.
- Skills and Supercomputer.

---

## 7. Dependency Order

App Factory should begin only after:

1. V2 architecture consolidation.
2. Dynaxis identity / organizations and permissions.
3. Provider-independent Job/Event infrastructure where Build actions need durable execution.
4. Project Graph extensions.
5. Agent / Engineering Contracts: Agent Role, Engineering Work Package, Worker Adapter, and Verification Gate.

Full Supercomputer-level orchestration is not required before App IR, software registries, blueprints, or repository modeling can begin. Those systems require the early contract foundation for safe delegation, while full worker scheduling, multi-agent coordination, Skills, memory-driven planning, and high-order orchestration remain later.

The first App Factory implementation should create one minimal App IR path behind feature flags, not a parallel product shell.
