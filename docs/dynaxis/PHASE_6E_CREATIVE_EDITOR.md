# Phase 6E — Non-Destructive Creative Editor

**Status:** Complete  
**Canonical:** `COMPOSITION_SYSTEM.md`  
**Source mined (not merged):** `SamurAIGPT/Open-Pomelli` (`canvas.tsx`, `layout.ts`, asset edit routes)

---

## 1. Open Pomelli editor inspection

### MIGRATE

- Editable headline/body/CTA blocks
- Brand palette swatches + font-family suggestions
- Background swap vs clean-background (`noText`) regeneration concept
- Nine-position alignment presets
- Aspect-ratio-aware preview

### ADAPT

- Layout JSON → Zod Composition Document v1
- Prisma `variants` blob → `dynaxis_compositions` + revisions
- Client canvas → DOM preview + `react-rnd` manipulation
- Export → server SVG + Resvg PNG + Dynaxis Asset registration
- Campaign integration → Deliverable → Composition → `final_asset_id`

### DEFER

- Animation / video layers
- Rich templates / effects / blend modes
- Multi-size responsive adaptation
- HTML/MP4 export

### DISCARD

- Prisma Asset persistence / standalone editor shell
- Destructive source Asset mutation
- Direct MuAPI from editor UI
- `dangerouslySetInnerHTML` / arbitrary remote image URLs in layers

---

## 2. Schema / migration

Migration: `drizzle/0005_dynaxis_compositions.sql`

- `dynaxis_compositions`
- `dynaxis_composition_revisions`
- `dynaxis_composition_exports`
- `dynaxis_asset_derivations`
- `dynaxis_campaign_deliverables.composition_id`, `final_asset_id`

---

## 3. Service + APIs

`lib/dynaxis/services/compositions.js` — create from Asset/Deliverable, draft update (stale-version guard), save revision, export, set final deliverable asset, clean-background generation request.

`/api/dynaxis/compositions/*`

---

## 4. Editor architecture

| Module | Role |
|--------|------|
| `compositions/document.js` | Zod schema |
| `compositions/layout.js` | Shared positioning (preview + SVG) |
| `compositions/initial-layout.js` | Deterministic Campaign layout |
| `compositions/undo.js` | Bounded client undo/redo |
| `compositions/svg-renderer.js` | Server SVG |
| `compositions/render-export.js` | Resvg PNG |
| `compositions/asset-fetch.js` | SSRF-safe image bytes |
| `packages/mini-apps/creative-editor/` | Mini App UI |

## Dependencies added

- `react-rnd` — layer drag/resize
- `@resvg/resvg-js` — server PNG rasterisation
- `@aws-sdk/client-s3` — production Asset Blob Store (Phase 6E.1)

---

## 5. Campaign integration

Campaign Studio results: **Edit in Creative Editor** → `?deliverableId=` opens or reuses Composition.  
Export can set `final_asset_id` without deleting original `asset_id`.

---

## 6. Tests

| Suite | Role |
|-------|------|
| `tests/dynaxis-compositions.test.mjs` | Domain/schema/layout; **mocked** rasterise + memory blob store |
| `tests/dynaxis-storage-export.test.mjs` | **Real** Resvg; blob store; S3 mock; clean-bg apply |
| `tests/dynaxis-boundary.test.mjs` | Client excludes storage/Resvg/services |

See also `PHASE_6E1_EDITOR_PRODUCTION_CLOSURE.md` for production storage closure.

---

## 7. Explicitly not done

Video editor · collaboration · template marketplace · publishing · Skills · Supercomputer · Dynaxis OS · Figma-class vector tooling.
