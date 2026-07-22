# Dynaxis Labs Studios — Repository Audit

**Phase:** 1 — Full repository audit and Dynaxis foundation  
**Date:** 2026-07-21  
**Audited tree:** `Open-Generative-AI/` (forked from `Anil-matcha/Open-Generative-AI`)  
**Workspace parent:** `dynaxis-labs-studios-July-26`  
**Scope:** Read-only inspection of implementation. No code changes in this phase.

---

## 1. Executive findings

This repository is a **production-capable creative studio shell** that already ships many high-value studios (image, video, cinema, audio, lip sync, clipping, vibe motion, marketing, body swap/recast, AI influencer) plus deeply integrated workflow, agent, and design-agent packages.

It is **not** a greenfield app. It is also **not** yet a unified Dynaxis platform:

- Identity is a **MuAPI `x-api-key` stored in `localStorage`**, not first-party accounts/orgs.
- Billing/credits are **MuAPI account balance**, not Dynaxis billing.
- Generation history and studio state are largely **browser `localStorage`**.
- Apps Studio is a **catalogue of external templates + placeholders**, not an internal module runtime.
- There are **two UI runtimes**: Next.js (web) and Vite/Electron (desktop), with duplicated studio implementations.

Upstream attribution and MIT licensing allow commercial fork/branding, provided copyright notices are preserved.

---

## 2. Repository topology

### 2.1 Top-level layout (implemented)

| Path | Role |
|------|------|
| `app/` | Next.js App Router (web host). Redirects `/` → `/studio`. |
| `components/` | Web shell: `StandaloneShell.js`, `ApiKeyModal.js`. |
| `packages/studio` | Primary React studio library consumed by Next.js. |
| `packages/Vibe-Workflow` | Git submodule → workflow builder UI + related server/client. |
| `packages/Open-Poe-AI` | Git submodule → agent chat UI package. |
| `packages/Open-AI-Design-Agent` | Git submodule → design/creative agent canvas. |
| `src/` | Electron/Vite vanilla-JS UI (parallel desktop surface). |
| `electron/` | Electron main/preload + local inference IPC. |
| `app/api/` | Next.js proxies to `https://api.muapi.ai` (+ upload helpers). |
| `middleware.js` | Security headers + rewrite proxy for many `/api/v1/*` paths. |
| `public/`, `docs/assets/` | Static assets / marketing media. |
| `tests/` | Node tests focused on local-inference helpers. |
| `build/`, `scripts/` | Electron packaging, local-AI binary staging, deb packaging. |
| `project_knowledge.md` | Upstream technical notes (partially outdated vs current dual-stack). |
| `models_dump.json` | Source dump used to generate `packages/studio/src/models.js`. |

### 2.2 npm workspaces (root `package.json`)

```
packages/studio
packages/Vibe-Workflow/packages/workflow-builder   (name: workflow-builder)
packages/Open-Poe-AI/packages/agents               (name: ai-agent)
packages/Open-AI-Design-Agent/packages/design-agent (name: design-agent)
```

Root depends on `studio`, `workflow-builder`, and `ai-agent`. `next.config.mjs` transpiles `studio`, `ai-agent`, `workflow-builder`, `design-agent`.

### 2.3 Git submodules (`.gitmodules`)

| Submodule path | Upstream |
|----------------|----------|
| `packages/Vibe-Workflow` | `https://github.com/SamurAIGPT/Vibe-Workflow.git` |
| `packages/Open-Poe-AI` | `https://github.com/Anil-matcha/Open-Poe-AI.git` |
| `packages/Open-AI-Design-Agent` | `https://github.com/Anil-matcha/Open-AI-Design-Agent` |

`npm run setup` runs `git submodule update --init --recursive && npm install && npm run build:packages`.

`packages/studio` is a **first-party workspace package**, not a submodule.

### 2.4 Dual application surfaces

| Surface | Entry | UI tech | Studios source |
|---------|-------|---------|----------------|
| **Web (recommended Dynaxis host)** | `npm run dev` → Next.js `app/` | React 19 + Next 15 | `packages/studio` via `StandaloneShell` |
| **Desktop** | `npm run electron:dev` → Vite build of `src/` + Electron | Vanilla JS components | `src/components/*` (partial parity) |

Models for Electron re-export studio models:

```js
// src/lib/models.js
export * from "studio/src/models.js";
```

MuAPI client is **duplicated**: `packages/studio/src/muapi.js` (function exports) vs `src/lib/muapi.js` (class `MuapiClient`).

---

## 3. Web application architecture (actual)

### 3.1 Routing

| Route | Implementation |
|-------|----------------|
| `/` | Redirects to `/studio` |
| `/studio/[[...slug]]` | Renders `StandaloneShell` |
| `/workflow/[id]`, `/workflow/[id]/[tab]` | Workflow deep-links (metadata titles only at page level; shell also handles workflow segments) |
| `/agents/*`, `/agents/create`, `/agents/edit/[id]` | Agent chat/create/edit pages wrapping `ai-agent` flows |
| `/assistant` | Assistant page present |
| `/api/*` | Proxies / upload routes (see §5) |

### 3.2 Studio shell (`components/StandaloneShell.js`)

Tabs currently mounted (web):

1. Image Studio  
2. Video Studio  
3. Audio Studio  
4. AI Clipping  
5. Vibe Motion  
6. Lip Sync  
7. Body Swap (`RecastStudio`)  
8. Cinema Studio  
9. Marketing Studio  
10. Workflows  
11. Agents  
12. Design Agent  
13. Explore Apps  
14. AI Influencer Studio  

**Not mounted in web shell:** MCP/CLI studio (exists in `packages/studio` and Electron `src/`).

Auth UX: `ApiKeyModal` + `localStorage` key `muapi_key`. Balance via `getUserBalance(apiKey)` → MuAPI `/api/v1/account/balance`.

Cross-tab generation notifications are shell-level (success/error toasts with jump-to-tab).

### 3.3 Shared studio package (`packages/studio`)

Exports (`packages/studio/src/index.js`):

- `ImageStudio`, `VideoStudio`, `ClippingStudio`, `VibeMotionStudio`, `LipSyncStudio`, `RecastStudio`, `CinemaStudio`, `AudioStudio`, `MarketingStudio`, `WorkflowStudio`, `AgentStudio`, `DesignAgentStudio`, `AppsStudio`, `McpCliStudio`, `AiInfluencerStudio`
- All MuAPI helpers from `./muapi`

Studio package depends on workspace packages:

- `workflow-builder` (Vibe Workflow)
- `ai-agent` (Open-Poe-AI)
- `design-agent` (Open-AI-Design-Agent)

Wiring evidence:

- `WorkflowUI.jsx` → `import { WorkflowBuilder } from "workflow-builder"`
- `DesignAgentStudio.jsx` → `import { CreativeCanvas } from 'design-agent'`
- Agent listing in `AgentStudio.jsx` uses MuAPI agent endpoints; dedicated agent chat routes use `ai-agent` package

---

## 4. Apps Studio audit (critical)

**File:** `packages/studio/src/components/AppsStudio.jsx`

### 4.1 What is actually integrated?

**None of the listed apps are loaded as internal modules.** There is no plugin loader, no dynamic import map, and no in-app runtime for mini-apps.

### 4.2 Template apps (external)

`templateApps` (5 entries) each provide:

- GitHub `repo` URL under `SamurAIGPT/*`
- Hosted `hosted` demo on Vercel
- Marketing thumbnail on `cdn.muapi.ai`

Apps:

1. AI Headshot Studio → `ai-headshot-generator`  
2. Nano Banana Studio → `nano-banana-generator`  
3. Seedance V2 Studio → `seedance-2-generator`  
4. AI Clipping Studio → `ai-clipping-generator`  
5. EasyVeo Studio → `veo4-video-generator`  

UI actions: real external links to GitHub + Demo.

### 4.3 Dummy / placeholder apps

`dummyAppsData` contains **~65 catalogue cards** (Pet Product Studio, AI Recruiter, Talk to PDF, etc.).

For dummies, GitHub/Demo buttons both open a **“Get Template” modal** (no real repo/demo URLs). They are placeholders for interest capture.

### 4.4 Interest / request-access flow

1. On mount (if `apiKey`): `getAppInterests(apiKey)` → `GET /api/app/interests` (via proxy base `/api`)  
2. “Get Template”: `registerAppInterest(apiKey, selectedApp.name)` → `POST /api/app/interest` with `{ app_name }`  
3. Success toast; local `requestedApps` updated  

This is **lead-gen against MuAPI**, not Dynaxis access control.

### 4.5 Plugin/module interface

**MISSING.** Apps Studio is a static catalogue UI only.

---

## 5. API / integration layer

### 5.1 MuAPI as system of record

All cloud generation, workflow persistence (server-side), agents, balance, uploads, and app interest flow through **MuAPI** (`https://api.muapi.ai`).

Primary client: `packages/studio/src/muapi.js`

Pattern:

1. `POST /api/v1/{endpoint}` with `x-api-key`  
2. Receive `request_id`  
3. Poll `GET /api/v1/predictions/{id}/result` until completed/failed  

### 5.2 Next.js proxy surface

| Route | Behaviour |
|-------|-----------|
| `middleware.js` | Rewrites many `/api/v1/*` to MuAPI; adds CSP/security headers |
| `app/api/api/v1/[[...path]]` | Explicit proxy for double `/api/api` paths used by agent lib |
| `app/api/workflow/[[...path]]` | Proxies `/workflow/*` |
| `app/api/app/[[...path]]` | Proxies `/app/*`; rewrite upload URL to local binary proxy |
| `app/api/agents/[[...path]]` | Agent API proxy |
| `app/api/v1/creative-agent/[[...path]]` | Design-agent related proxy |
| `app/api/v1/get_upload_url`, `upload-binary`, `app/api/upload-binary` | Upload URL + binary PUT helpers |

There is **no first-party Dynaxis API server** in this repo for auth/billing/assets.

### 5.3 Vite proxy (Electron/dev)

`vite.config.mjs` proxies `/api` → `https://api.muapi.ai`.

---

## 6. Advanced systems (must preserve)

| Capability | Location | Notes |
|------------|----------|-------|
| Vibe Workflow | submodule + `WorkflowStudio` / `WorkflowUI` | Full node editor; MuAPI-backed defs/runs |
| Agents | submodule `ai-agent` + `AgentStudio` + `/agents` routes | Chat, create, edit; MuAPI-backed |
| Design Agent | submodule `design-agent` + `DesignAgentStudio` | Embeds `CreativeCanvas`; stores API key as `localStorage.token` |
| Cinema tools | `CinemaStudio.jsx` (+ Electron cinema) | Rich creative controls; localStorage persist |
| Local inference | `electron/lib/*`, `src/lib/localInferenceClient.js`, preload IPC | sd.cpp binary + Wan2GP Gradio bridge |
| Electron packaging | `package.json` build config, scripts | mac/win/linux |
| MCP/CLI | `McpCliStudio` marketing/docs UI linking to external `muapi-cli` / MCP server / skills | Not an in-process MCP host |
| Model catalogue | `packages/studio/src/models.js` (~12.5k lines, generated from dump) | Shared SoT for Electron via re-export |

---

## 7. Electron / desktop specifics

- Loads Vite-built `dist/index.html`
- Exposes `window.localAI` via `electron/preload.js`
- Local engines: **sd.cpp** download/manage/generate; **Wan2GP** remote Gradio
- Desktop UI (`src/main.js`) mounts a **subset** of studios: image, video, cinema, lipsync, workflows, agents, mcp-cli
- Desktop does **not** currently surface the full Next.js studio set (no clipping/marketing/apps/influencer/design-agent tabs in `src/main.js` router)

---

## 8. Duplication hotspots (document only; do not consolidate yet)

See also `CURRENT_ARCHITECTURE.md` §Duplication.

1. **MuAPI clients:** `packages/studio/src/muapi.js` vs `src/lib/muapi.js`  
2. **Studio UIs:** React JSX in `packages/studio` vs vanilla JS in `src/components`  
3. **Upload / poll / history patterns** reimplemented per studio with distinct `PERSIST_KEY`s (`hg_*_persistent`)  
4. **Auth assumptions:** `muapi_key` vs Design Agent `token` vs agent package session patterns  
5. **Proxy strategies:** Next middleware/routes vs Vite proxy vs direct Electron calls  
6. **project_knowledge.md** describes an older Vite-only architecture  

---

## 9. What Dynaxis does **not** have yet (in-repo)

- First-party user accounts / sessions / SSO  
- Organisations / workspaces / RBAC  
- Projects as a first-class entity  
- Unified asset library (beyond per-studio localStorage + MuAPI CDN URLs)  
- First-party billing/subscriptions (beyond MuAPI balance display)  
- Job queue owned by Dynaxis  
- Telemetry / structured logging platform  
- Mini-app module contract / runtime  
- Skills system as an in-platform product surface (only marketing links)  

---

## 10. Documentation produced in this phase

| Document | Purpose |
|----------|---------|
| `REPOSITORY_AUDIT.md` | This file |
| `CURRENT_ARCHITECTURE.md` | As-built system map |
| `TARGET_ARCHITECTURE.md` | Dynaxis production target |
| `MINI_APP_INTEGRATION_ARCHITECTURE.md` | Module contract proposal |
| `PLATFORM_SERVICES_AUDIT.md` | Capability maturity matrix |
| `BRANDING_MIGRATION.md` | Safe rename inventory |
| `LICENSING_AUDIT.md` | Licence / attribution table |
| `INTEGRATION_ROADMAP.md` | Phased plan (2–8 not started) |

---

## 11. Audit confidence notes

- Apps Studio behaviour verified by full file read.  
- Platform service classifications based on code paths, not README marketing claims.  
- `project_knowledge.md` is **not** authoritative for the current Next.js-hosted architecture.  
- Submodule internal servers (`Open-Poe-AI/server`, `Vibe-Workflow` server) exist upstream but are **not** the primary runtime path for the Next.js shell, which proxies to MuAPI.
