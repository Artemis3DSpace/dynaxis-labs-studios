# Dynaxis Labs Studios — Phase 2 Final Validation

**Status:** Validated and architecturally stable  
**Date:** 2026-07-21  
**Verdict:** Phase 2 is production-appropriate for its stated scope. No Phase 2 regressions found in package builds, Next.js production build, or Electron helper tests. UI/UX baseline is locked.

**Related:** `CURRENT_ARCHITECTURE.md`, `PHASE_2_IMPLEMENTATION.md`, `PLATFORM_SERVICES_AUDIT.md`

---

## Current Product Architecture

Dynaxis Labs Studios remains a **rich client + MuAPI proxy shell** with a Dynaxis product layer:

```text
User (browser / Electron)
  → Dynaxis shell (StandaloneShell + lib/dynaxis/*)
  → packages/studio | workflow | agent | design-agent
  → Next.js /api/* proxies (or Electron local AI paths)
  → MuAPI (api.muapi.ai) for cloud generation
```

Phase 2 added:

| Layer | Location | Role |
|-------|----------|------|
| Product config | `lib/dynaxis/product.js` | Names, attribution, session key names |
| Feature registry | `lib/dynaxis/features.js` | Stable IDs, categories, routes, honesty flags |
| Navigation IA | `lib/dynaxis/navigation.js` | Create / Build / Apps / Connect |
| Session API | `lib/dynaxis/session.js` | MuAPI key + cookie + Design Agent token mirror |
| Platform contracts | `lib/dynaxis/platform.js` | Interfaces/stubs — **not** production services |
| Application shell | `components/StandaloneShell.js` | Dynaxis chrome around existing studios |

**Not introduced:** microservices, Redis, Kafka, new databases, Auth0/Clerk/NextAuth, duplicate MuAPI gateways, fake billing, or Dynaxis identity accounts.

---

## Existing Studios

All Create / Build / Apps / Connect surfaces listed below are mounted in the web shell and backed by existing `packages/studio` (or package) implementations. Phase 2 did not rewrite studio business logic.

### Create (functional studios)

| Feature ID | View | Status |
|------------|------|--------|
| `image-studio` | image | Functional — MuAPI generate + poll |
| `video-studio` | video | Functional |
| `cinema-studio` | cinema | Functional (image-backed cinematic controls) |
| `audio-studio` | audio | Functional |
| `lipsync-studio` | lipsync | Functional |
| `vibe-motion` | vibe-motion | Functional |
| `clipping-studio` | clipping | Functional |
| `body-swap` | body-swap | Functional (Recast) |
| `ai-influencer` | ai-influencer | Functional |
| `marketing-studio` | marketing | Functional |

### Build

| Feature ID | Status |
|------------|--------|
| `workflow-studio` | Functional — Vibe Workflow package boundary intact |
| `agent-studio` | Functional — Open-Poe agents package; MuAPI-backed |
| `design-agent` | Functional — design-agent package; token mirrored via session |

### Apps / Connect / Platform

| Feature ID | Honest representation |
|------------|----------------------|
| `apps` | Catalogue / templates / interest — **not** installed mini-apps |
| `mcp-cli` | Integration docs/links surface in shell |
| `settings` | API key + attribution (modal; not a nav tab) |

Local models / Electron local AI remain on the desktop path; not claimed as full web parity.

---

## Platform Boundaries

Precise status of `lib/dynaxis/platform.js` vs runtime reality:

| Service | Classification | Reality today |
|---------|----------------|---------------|
| **Identity** | `INTERFACE / CONTRACT` + `PARTIAL` | MuAPI API-key session via `session.js`. Soft `isAuthenticated` = key present. **Not** Dynaxis accounts. Stubs for user profile throw. |
| **Workspaces** | `INTERFACE / CONTRACT` + `MISSING` | No org/workspace entity. Methods throw. |
| **Projects** | `INTERFACE / CONTRACT` + `MISSING` | No project entity. Methods throw. |
| **Assets** | `INTERFACE / CONTRACT` + `PARTIAL` | MuAPI upload URLs + per-studio local state. No unified Dynaxis asset library. Service methods throw. |
| **Generation history** | `INTERFACE / CONTRACT` + `PARTIAL` / `ADAPTER OVER EXISTING` | Fragmented `hg_*` localStorage per studio. No cross-studio Dynaxis timeline. Service methods throw. |
| **Billing** | `INTERFACE / CONTRACT` + `MISSING` | External MuAPI account only. Stub throws. |
| **Credits** | `INTERFACE / CONTRACT` + `ADAPTER OVER EXISTING` (display path) | Balance via studio `getUserBalance` → MuAPI. `creditsService` stub throws if called. |
| **Storage** | `INTERFACE / CONTRACT` + `ADAPTER OVER EXISTING` | Next upload proxies + MuAPI upload helpers. Dynaxis `storageService` stub throws. |
| **Jobs** | `INTERFACE / CONTRACT` + `PARTIAL` | Client `submitAndPoll` / `pollForResult` in `packages/studio/src/muapi.js`. No Dynaxis job table. Stubs throw. |
| **Model gateway** | `INTERFACE / CONTRACT` + `ADAPTER OVER EXISTING` | Real path: `muapi.js` + `models.js`. Stub gateway returns empty / throws on submit. |

**Rule:** Do not treat platform stubs as production implementations.

---

## MuAPI Integration

- Hosts unchanged: `api.muapi.ai`, `cdn.muapi.ai`.
- Proxies: `/api/api/v1/*`, `/api/app/*`, `/api/workflow/*`, `/api/agents/*`, design-agent creative routes, upload helpers.
- Auth to MuAPI: client sends `x-api-key` (from Dynaxis session helper).
- Generation entry: primarily `packages/studio/src/muapi.js` (`submitAndPoll`).

### Remaining duplicate / parallel access patterns (document only — do not rewrite now)

1. Studio package MuAPI helpers (canonical for Create studios).
2. Workflow package → `/api/workflow` proxy.
3. Agent package → `/api/agents` + cookie `muapi_key` for SSR agent pages.
4. Design Agent → creative-agent proxies + `localStorage.token` mirror.
5. Electron / local AI paths that bypass MuAPI for on-device models.

Future consolidation belongs with a Dynaxis Jobs / Model Gateway service (Phase 3+), not a broad rewrite in this pass.

---

## Execution Lifecycle

Typical cloud generation path:

```text
User action in Studio
  → packages/studio component
  → muapi.js submit (POST prediction/generate endpoint)
  → prediction / request ID
  → poll GET .../predictions/{id}/result (client-side)
  → result URL(s)
  → UI gallery + optional localStorage persistence (hg_*)
```

| Concern | Current behaviour |
|---------|-------------------|
| Job submission | Per-studio → shared `submitAndPoll` |
| Prediction IDs | Returned from MuAPI; optional `onRequestId` callbacks |
| Polling | Client-side loop in `muapi.js` (attempt caps vary by modality) |
| Completion / failure | Status from poll response; errors surfaced in studio UI |
| Retry | Studio-level UX; no shared Dynaxis retry service |
| Cancellation | Not a unified Dynaxis capability; provider-dependent |
| Result retrieval | Result payload / CDN URLs from MuAPI |
| History | Per-studio `localStorage` keys; not server-backed |

**Future shared layer** should sit between Studio UI and MuAPI proxies: Dynaxis Jobs + Asset record + History write, without replacing MuAPI as the generation provider.

---

## Projects / Assets / History — source of truth

| Domain | Source of truth today | Survives refresh | Survives logout / clear key | Cross-device | Web ↔ Electron |
|--------|----------------------|------------------|-----------------------------|--------------|----------------|
| **Projects** | **MISSING** | N/A | N/A | N/A | N/A |
| **Assets** | MuAPI/CDN URLs + ephemeral UI state; some studios store URL lists in `localStorage` | Partially (local only) | Lost if storage cleared | No | No shared store |
| **History** | Per-studio `hg_*` keys in browser `localStorage` | Yes (same browser profile) | Lost if storage cleared | No | No |

There is **no** Dynaxis database-backed project, asset, or history service yet.

---

## Apps

Phase 2 kept Apps **architecturally honest**:

- Catalogue / external templates / request-access style entries.
- Not presented as an installed mini-app runtime.
- No iframe embedding of SamurAIGPT apps.
- Mini-app framework remains governed by `MINI_APP_INTEGRATION_ARCHITECTURE.md` (deferred).

---

## Workflow / Agent / Design Agent

| Surface | Boundary | Phase 2 impact | Future note |
|---------|----------|----------------|-------------|
| Workflow Studio | `packages/workflow-builder` (Vibe Workflow) | Shell mounts only; package intact | Later: jobs/assets/projects association |
| Agent Studio | `packages/ai-agent` | Session cookie sync retained for SSR | Not the Supercomputer |
| Design Agent | `packages/design-agent` | Token mirrored via `session.js` | Later callable Skill/capability — not converted yet |

---

## Electron

- Electron tree (`electron/`, Vite `src/`) retained.
- Dynaxis branding applied; `appId` remains `ai.generative.open` (intentional).
- Local inference / Apple Silicon paths not removed by Phase 2 web work.
- **Duplication remains:** parallel vanilla studios vs `packages/studio`. Full unification deferred.

Unit tests covering Electron/local helpers: **17/17 pass**.

---

## UI/UX — approved baseline (LOCKED)

The current Dynaxis Labs Studios visual layout, logo (`public/banner.png`), navigation, shell chrome, colour system, and interaction patterns are the **approved production baseline**.

- Do **not** redesign logo, shell, nav, layout, hierarchy, or colour system without explicit instruction.
- Engineering work must fit under this UI.
- Visual changes only for genuine functional, accessibility, responsive, or regression defects.

---

## Over-engineering check

| Item | Present? | Action |
|------|----------|--------|
| Microservices / Redis / Kafka / new DBs | No | — |
| Mock billing / fake full auth IdP | No | — |
| Duplicate MuAPI API clients as new Dynaxis gateway | No (stubs only) | Keep stubs; document |
| Speculative services with no consumer | Platform stubs only | **Keep** — intentional Phase 3 boundaries; low risk |
| Clerk / Auth0 / NextAuth / Supabase Auth / Firebase | No | — |

No removal pass required beyond documentation precision.

---

## Cookie / auth / session

- Canonical client API: `lib/dynaxis/session.js`.
- Storage key: `muapi_key` (compatibility preserved).
- Cookie sync for agent SSR retained.
- Design Agent `token` mirrored.
- Localhost-only “Preview platform UI” unlock is a **UI gate**, not Dynaxis identity.
- Phase 2 did **not** introduce a pretend full identity platform.

---

## Licensing / attribution

- MIT licence retained.
- Dynaxis Labs copyright **alongside** upstream Open Generative AI contributors.
- User-facing brand: Dynaxis Labs Studios.
- Technical/legal upstream attribution preserved in settings / docs.
- npm package name `open-generative-ai` and Electron `appId` intentionally unchanged.

---

## Validation

| Check | Result | Classification |
|-------|--------|----------------|
| `npm run build:packages` (workflow, agent, design, studio) | Pass | — |
| `npm run build` (Next.js 15 production) | Pass (`NEXT_BUILD:0`) | — |
| `node --test tests/*.test.js` | Pass 17/17 | — |
| `npm run lint` | Interactive ESLint setup prompt; no root ESLint config | **UPSTREAM / PRE-EXISTING** |
| Dedicated host `tsc` project | N/A (JS host); Next build type validity step completed | — |
| Phase 2 regressions in builds | None observed | — |

---

## Technical Debt (confirmed only)

1. Dual web (`packages/studio`) vs Electron (`src/`) studio stacks.
2. Fragmented generation history (`hg_*` localStorage); no projects.
3. Multiple MuAPI access patterns (studio / workflow / agents / design-agent).
4. Platform service stubs throw if imported and called — correct for Phase 2, confusing if misused as implementations.
5. Lint not configured at repo root (upstream).
6. Packaging identity still `open-generative-ai` / `ai.generative.open`.

---

## Deferred Work

- Shared Dynaxis platform services (Projects, Assets, History, Jobs)
- Mini-app integration framework + migrations
- Skills system
- Supercomputer / orchestration
- Dynaxis OS
- Full Electron ↔ web unification
- Broad MuAPI client consolidation
- Packaging `appId` / data-dir migration

---

## Recommended Phase 3 scope (evidence-based)

**Do not implement in this task.** Recommended next phase:

### Phase 3 — Shared Dynaxis platform foundation

1. **Projects** — first Dynaxis-owned entity (even if initially local/server-light).
2. **Assets** — unified metadata around existing MuAPI/CDN URLs (ownership, prompt, model, timestamps, project association).
3. **Generation History** — cross-studio timeline replacing fragmented `hg_*` as source of truth (migrate, don’t abandon overnight).
4. **Jobs / generation lifecycle** — shared submit/poll/status/cancel façade over current MuAPI paths; studios become consumers.

**Explicitly out of Phase 3:** mini-app runtime, SamurAIGPT migrations, Skills, Supercomputer, Dynaxis OS, UI redesign, Auth provider swap unless separately instructed.

Rationale: without Projects / Assets / History / Jobs, mini-app migration and orchestration have no durable shared substrate.

---

## End condition

Phase 2 is **validated**. Architecture is **stable**. UI/UX remains **locked**. Phase 3 is **recommended only**, not started.
