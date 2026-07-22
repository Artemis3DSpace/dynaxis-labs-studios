# Phase 6F — Design Library + Composition Templates + Multi-Aspect Adaptation

**Status:** Complete  
**Canonical:** `DESIGN_LIBRARY.md`  
**Depends on:** Phases 6D–6E.1 (Campaigns, Compositions, Creative Editor, Blob Store)

---

## 1. Phase 6E.1 host executor verification

**Finding:** Already correctly wired — no architecture change.

- `components/MiniAppHost.js` defaults `executeGeneration` to `executeMiniAppMuapiGeneration` and injects it into `createMiniAppRuntime`.
- Creative Editor is registered (`dynaxis.creative-editor`) and allowlisted in the loader.
- Test: `tests/dynaxis-miniapp-host-executor.test.mjs` proves  
  `Creative Editor → runtime.createGeneration → host executor → mocked provider → completed Asset`.

---

## 2. Design Agent audit (not integrated)

| Item | Observation |
|------|-------------|
| Host | `packages/studio/src/components/DesignAgentStudio.jsx` — thin wrapper |
| Package | `design-agent` / `CreativeCanvas` (Konva) |
| Persistence | Sets `sessionStorage.fromDesignAgent`, `localStorage.token` (MuAPI key) |
| Balance | `getUserBalance(apiKey)` for MuAPI credits |
| Document model | External canvas state — **not** Dynaxis Composition Document v1 |
| Programmable ops | No Dynaxis Template/Composition API surface |

**Boundary:** Design Agent remains intact and separate. Phase 6G+ may later consume Dynaxis Template/Composition headless APIs. Dynaxis Composition must not depend on `design-agent`.

---

## 3. Template domain

- Owner-scoped `dynaxis_design_templates` (reusable across Projects)
- Immutable `dynaxis_design_template_revisions`
- Statuses: `draft` · `active` · `archived`
- Categories: `social`, `advertising`, `presentation`, `product`, `campaign`, `thumbnail`, `banner`, `custom`
- Optional tags (normalized text); optional Brand-neutral / Brand-bound metadata
- Thumbnails = normal Dynaxis Assets via existing Resvg pipeline

Migration: `drizzle/0006_dynaxis_design_templates.sql`

---

## 4. Schema & binding

- Template Document reuses Composition layer Zod primitives
- Explicit semantic slots (text/image) with required/optional validation
- Binding precedence documented in `DESIGN_LIBRARY.md`
- Instantiation creates independent Compositions with `template_id` / `template_revision_id`
- No live component propagation

---

## 5. Adaptation

- Engine version `adapt-v1` (`lib/dynaxis/templates/adapt.js`)
- Optional layer adaptation hints (backward-compatible)
- Format safe-area guidance from Campaign format registry
- Structured warnings; batch adaptation with partial success
- Provenance: `source_composition_id`, `adaptation_engine_version`, `adaptation_target_format_id`

---

## 6. Surfaces & APIs

| Surface | ID |
|---------|-----|
| Design Library Mini App | `dynaxis.design-library` |
| Creative Editor Template mode + Save as Template + Adapt aspect | `dynaxis.creative-editor` |
| Campaign optional Template select | `dynaxis.campaign-studio` |

APIs:

- `/api/dynaxis/design-templates/*`
- `/api/dynaxis/design-templates/instantiate`
- `/api/dynaxis/compositions/adapt`

Permissions: `templates:read`, `templates:write`.

Headless ops: create / from-composition / revision / instantiate / bind / adapt / preview thumbnail.

---

## 7. Campaign integration

- Deliverable **without** Template → existing initial layout path unchanged
- Deliverable **with** Template → instantiate + bind copy/Brand/background → Composition → Creative Editor
- Template controls layout; AI image generation remains separate

---

## 8. Security & boundaries

- Owner checks on Template, revision, Composition, Brand, Product, Character, Asset, Campaign/Deliverable
- Template ID alone does not authorize
- Client-safe: `lib/dynaxis/templates/*`
- Server-only: `services/templates.js` + Drizzle stores
- Boundary tests extended for Template modules

---

## 9. Deferred (explicit)

- Design Agent sync
- Linked Components / master propagation
- Marketplace / publishing / import-export
- 21st.dev / Aura / Figma Community
- Design Token DB
- Skills / Supercomputer / Dynaxis OS

---

## 10. Recommended Phase 6G

**Design Agent → Dynaxis Composition bridge (read/write adapters only)** — decide how external CreativeCanvas maps to Composition/Template documents without dual live canvases; keep Templates headless and Dynaxis-owned.
