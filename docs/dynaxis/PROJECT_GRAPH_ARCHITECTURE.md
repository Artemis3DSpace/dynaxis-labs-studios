# Dynaxis Labs Studios - Project Graph Architecture

**Status:** Planned extension of the existing Project domain.  
**Rule:** Extend `dynaxis_projects` later. Do not replace the persistent Project domain.

---

## 1. Implemented Now

`dynaxis_projects` is implemented and used by platform services:

- Default Project per owner.
- Project-scoped Assets, Generations, Jobs.
- Project links for Characters, Products, Brands, Campaigns.
- Composition, Template, Component, Design System, and Mini App flows use active Project context where appropriate.
- Lifecycle APIs resolve explicit Project or Default Project.

Current Project is primarily a container and ownership boundary, not yet a full graph.

---

## 2. Planned Graph Model

The future Project Graph connects all project knowledge, creative state, software architecture, engineering work, and deployment provenance.

```text
Project
  -> Creative nodes
  -> Product/domain nodes
  -> Build/App IR nodes
  -> Engineering nodes
  -> Knowledge/memory nodes
  -> Job/event/audit nodes
```

Graph edges should be typed and auditable. Examples:

- `uses_asset`;
- `generated_by`;
- `derived_from`;
- `pins_revision`;
- `implements_capability`;
- `uses_blueprint`;
- `instantiates_component`;
- `assigned_to_work_package`;
- `verified_by`;
- `deployed_to`;
- `supersedes`.

---

## 3. Node Families

### Implemented creative/product nodes

- Project;
- Asset;
- Generation;
- Job;
- Character and Character Revision;
- Product and Product Revision;
- Brand and Brand Revision;
- Campaign and Campaign Revision;
- Campaign Concept and Deliverable;
- Composition and Composition Revision;
- Composition Export;
- Design Template and Template Revision;
- Design Component and Component Revision;
- Design System and Design System Revision;
- Component Set and Component Set Variant.

### Planned Build nodes

- App IR and App IR Revision;
- Software Component and Component Version;
- Software Blueprint and Blueprint Revision;
- Application Capability;
- Repository;
- Branch / worktree;
- Build environment;
- Deployment target;
- Release.

### Planned orchestration nodes

- Work Package;
- Agent Role Assignment;
- Worker Execution;
- Skill Invocation;
- Verification Gate;
- Decision Record;
- Memory Entry;
- Audit Event.

---

## 4. Design / Build / Engineer Views

The graph supports different views over the same Project:

| View | Graph focus |
|------|-------------|
| Design | Compositions, templates, components, design systems, assets, generated media |
| Build | requirements, blueprints, App IR, software capabilities, component choices |
| Engineer | repositories, branches, work packages, tests, deployments, observability |

No view owns a separate project model.

---

## 5. Knowledge and Memory

Project knowledge should become structured, queryable, and permissioned:

- requirements and briefs;
- business/domain facts;
- brand/product/character/campaign context;
- architecture decisions;
- user constraints;
- accepted/rejected designs;
- verified components and blueprints;
- provider execution history.

Memory entries must cite source nodes or explicit user decisions. They should not become ungrounded model chat logs.

---

## 6. Persistence Strategy

Do not replace current normalized domain tables with one generic graph table.

Recommended approach:

1. Keep durable domain tables as canonical records.
2. Add typed graph-edge tables or materialized graph projections.
3. Add audit/event records for changes.
4. Expose graph query APIs by Project.
5. Let specialized domains keep their own invariants.

This preserves Phase 1-6I production work while adding cross-domain reasoning.

---

## 7. Deferred

- Graph schema and migrations.
- Graph query API.
- Knowledge/memory service.
- Audit/event stream.
- App IR graph nodes.
- Repository/deployment graph nodes.
- Agent/work-package graph nodes.
