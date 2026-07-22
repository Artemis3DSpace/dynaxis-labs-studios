# Phase 6G — Design Agent → Dynaxis Composition Bridge

**Status:** Complete  
**Canonical:** `DESIGN_AGENT_ARCHITECTURE.md`  
**Depends on:** Phases 6E–6F (Compositions, Templates, Creative Editor)

---

## 1. External Design Agent audit

Package: `packages/Open-AI-Design-Agent/packages/design-agent` (`CreativeCanvas` + `CanvasArea` Konva).

- Ephemeral URL-based nodes (image/video/audio/text); not Composition Document v1
- MuAPI creative-agent sessions; `localStorage.token`; balance display
- No Dynaxis Composition/Template APIs; no undo; client `toDataURL` export
- Studio host previously mirrored API key into `localStorage.token` and gated on MuAPI balance

---

## 2. MIGRATE / ADAPT / RETIRE / PRESERVE TEMPORARILY

### MIGRATE
Natural-language design requests; plan/approve UX; concrete layout/text/image change intents; Generation → Asset placement pattern.

### ADAPT
Document reads/writes → Composition ops; Assets by ID; Brand/Product/Character/Campaign context; Templates; adaptation; save/export via existing services; LLM via `executeLlmChat`.

### RETIRE (as authority)
Konva JSON as SoT; CreativeCanvas persistence; Design Agent `localStorage.token` authority; MuAPI balance as auth; direct provider calls from Design Agent Studio; dual live canvases.

### PRESERVE TEMPORARILY
`design-agent` npm package on disk (not imported by Design Agent Studio); `sessionStorage.fromDesignAgent` for shell navigation; session helper may still mirror `token` for unrelated MuAPI proxy consumers — Design Agent Studio itself does not set or require it.

---

## 3. CreativeCanvas decision — **PATH B**

CreativeCanvas tightly couples Konva state, MuAPI agent loop, and auth. Adapting it as Composition controller would create dual authorities.

**Selected:** Extract Agent UX as Dynaxis Composition controller; retire CreativeCanvas as document authority. Composition preview matches Creative Editor geometry (CSS layers from Composition Document).

---

## 4–8. Protocol / executor / concurrency / plans

- `DesignOperation` Zod union + `DesignOperationBatch` + `DesignActionPlan`
- Pure `applyDesignOperations`
- Server `applyDesignAgentOperations` with atomic validation + `DESIGN_AGENT_STALE_COMPOSITION`
- LLM returns JSON plan only; never direct DB mutation

---

## 9–11. LLM boundary / auth / balance

- `/api/dynaxis/design-agent` `plan` uses server `executeLlmChat`
- DesignAgentStudio: no `localStorage.token`, no `getUserBalance`
- Authorization = Dynaxis platform ownership

---

## 12–20. Assets, imagery, contexts, Templates, adaptation

- Project-scoped Asset discovery; approved ID sets
- `prepareImageGeneration` → host Generation → `attachGeneratedAsset`
- Brand/Product/Character/Campaign projections omit private chat/system prompts
- Template list/instantiate reuse Phase 6F; Agent edits do not mutate Template revisions
- Adaptation reuses `adaptComposition`; warnings surfaced

---

## 21–23. Creative Editor handoff / revisions / export

- `Open in Creative Editor?compositionId=`
- Save revision / export via existing Composition Service + Resvg

---

## 24. Colour-only Template thumbnail

Confirmed: colour + text Templates preview successfully without image Assets (`generateTemplatePreview` + empty `assetsById`). Test covers this.

---

## 25. Cross-Project Asset policy

Same-owner Brand/Product/Character Assets may bind across Projects. Hallucinated / other-owner Asset IDs rejected. Documented in `DESIGN_AGENT_ARCHITECTURE.md`.

---

## 26–27. Security / boundary

Prompt-injection guidance in system prompt; typed ops only; no `external:network` on Design Agent surface; client-safe `design-agent/*`; server `services/design-agent.js`. Boundary tests extended.

---

## 28–30. Tests / builds / smoke

See test suite `tests/dynaxis-design-agent.test.mjs` + full `test:dynaxis`.  
Local smoke: open Composition → plan/apply (mocked LLM in tests) → Creative Editor same id → Resvg export.

---

## 31. Recommended Phase 6H

**Optional Design Agent conversation persistence + richer Generation UX in-studio** (still Composition-canonical; still no Konva SoT) — or Campaign video deliverables / publishing adapters if product priority shifts. Do not start Skills/Supercomputer/linked Components.
