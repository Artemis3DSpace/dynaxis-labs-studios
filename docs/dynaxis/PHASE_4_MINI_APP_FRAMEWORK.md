# Dynaxis Labs Studios — Phase 4 Mini App Framework

**Status:** Complete  
**Date:** 2026-07-21  
**Scope:** Typed Mini App module framework (manifest, registry, runtime, permissions, lazy loading, template)  
**Not in scope:** Mass SamurAIGPT import, Skills, Supercomputer, Dynaxis OS, marketplace, Phase 5 integrations  
**UI/UX:** Approved baseline **preserved**

---

## Definition

A **Dynaxis Mini App** is an internal product module inside Dynaxis Labs Studios.

It may provide specialised UI and domain workflow logic.

It **must** use shared Dynaxis platform services (Projects, Assets, Generations, Jobs, MuAPI adapter).

It **must not** bring duplicate auth, billing, Stripe, accounts, project/asset DBs, job lifecycle, shell, or MuAPI key management.

---

## Architecture

```text
Dynaxis Labs Studios
  → Feature Registry          (top-level Create/Build/Apps/Connect)
  → Apps
      → Mini App Registry     (integrated modules)
      → Catalogue source      (external/template/placeholders — honest)
  → Mini App Manifest
  → Mini App Runtime (permissioned)
      → Project / Asset / Generation / Job services
      → MuAPI Provider Adapter
      → MuAPI
      → Asset → Project
```

### Feature Registry vs Mini App Registry

| Registry | Role |
|----------|------|
| **Feature Registry** | Major product capabilities (Image Studio, Workflows, Agents, Apps surface, …) |
| **Mini App Registry** | Specialised modules hosted under Apps; consume platform services via runtime |

Workflow Studio, Agent Studio, and Design Agent remain **top-level features**, not Mini Apps.

---

## Manifest

Typed Zod schema: `lib/dynaxis/mini-apps/manifest.js`

Includes: id (reverse-dns), name, description, version, category, status, moduleType, viewId, entryKey, permissions, requiredCapabilities, assetInputs/outputs, modelCapabilities, project/generation/asset/network flags, attribution, capabilitySummary (machine-readable for future Skills/Supercomputer).

Statuses: `integrated` | `available` | `catalogue` | `external` | `disabled` | `experimental`

Catalogue/external must never be presented as installed.

---

## Registry & lazy loading

- `MiniAppRegistry` — register / get / list / listUserVisible / duplicate detection  
- Allowlisted loaders only (`lib/dynaxis/mini-apps/loader.js`)  
- Unknown IDs and non-allowlisted entryKeys fail safely  
- No remote code execution, no arbitrary path imports  

---

## Runtime & permissions

`createMiniAppRuntime` grants only declared permissions:

`project:read|write`, `assets:read|write`, `generation:create|read`, `jobs:create|read`, `models:use`, `external:network`

Denied access throws `MiniAppPermissionError`.

Generation goes through Dynaxis lifecycle APIs with `featureId` / `metadata.miniAppId` provenance — not ad-hoc MuAPI clients inside modules.

Domain logic should live in capability modules (see example `capability.js`) separate from React UI for future Skills/Agents.

---

## Apps catalogue honesty

- External templates + placeholders remain catalogue  
- Integrated modules from `listUserVisible()` appear in a separate “Dynaxis modules” section  
- Example module is `experimental` and **not** shown as a production Apps card  

---

## Template

`packages/mini-apps/example/` — framework test only:

- `manifest.js`
- `capability.js` (headless-friendly)
- `ExampleMiniApp.js`
- `index.js`

---

## Security boundaries

- No DB/Drizzle exposure to modules  
- No secrets in runtime  
- Allowlisted dynamic imports only  
- Error boundary isolates module crashes from the shell  
- Module permissions ≠ enterprise RBAC  

---

## Migration strategy (standalone → Dynaxis)

See `MINI_APP_DEVELOPER_GUIDE.md`.

1. Inspect unique UI/workflow/MuAPI usage  
2. Discard SaaS duplication (auth, Stripe, landing, independent DBs)  
3. Extract capability into Mini App module  
4. Connect Project / Asset / Generation / Job via runtime  
5. Validate as platform module  

---

## Key paths

```text
lib/dynaxis/mini-apps/*
packages/mini-apps/example/*
components/MiniAppHost.js
components/MiniAppErrorBoundary.js
```

---

## Validation

| Check | Result |
|-------|--------|
| `npm run test:dynaxis` | Pass (30) |
| Electron unit tests | Pass (17) |
| `build:packages` | Pass |
| `next build` | Pass |

---

## Recommended Phase 5

Integrate **one** high-value SamurAIGPT app as the first real Mini App — recommended candidate: **AI Headshot** (clear domain UI, strong demo value, maps cleanly to image generation + Assets). Extract capability only; discard Stripe/auth/standalone shell.
