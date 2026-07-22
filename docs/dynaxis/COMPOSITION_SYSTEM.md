# Dynaxis Composition System

**Canonical architecture** for non-destructive editable Compositions and deterministic PNG export.  
**Phase introduction:** `PHASE_6E_CREATIVE_EDITOR.md`  
**Production closure:** `PHASE_6E1_EDITOR_PRODUCTION_CLOSURE.md`  
**Templates / adaptation:** `DESIGN_LIBRARY.md` · `PHASE_6F_DESIGN_LIBRARY.md`  
**Design Components:** `DESIGN_COMPONENTS.md` · `PHASE_6H_DESIGN_COMPONENTS.md`  
**Design Systems:** `DESIGN_SYSTEMS.md` · `PHASE_6I_DESIGN_SYSTEMS.md`  
**Design Agent:** `DESIGN_AGENT_ARCHITECTURE.md` · `PHASE_6G_DESIGN_AGENT_BRIDGE.md`

---

## Distinctions

| Entity | What it is | What it is not |
|--------|------------|----------------|
| **Composition** | Editable structured document referencing Assets | An Asset, Deliverable, or Generation |
| **Composition revision** | Immutable snapshot of document + context | The live draft |
| **Composition export** | Record linking revision → derived PNG Asset | A Generation/Job |
| **Asset derivation** | Lineage from source Asset(s) → exported Asset | Destructive overwrite |
| **Asset Blob Store** | Durable binary storage for Dynaxis-managed Assets | PostgreSQL / data URLs |

Source Assets are never mutated. Every export creates a new derived Asset.

---

## Domain model

```text
Project
  └─ Composition
       ├─ mutable document JSON + documentVersion (optimistic concurrency)
       ├─ Composition revisions (immutable snapshots)
       ├─ Composition exports → PNG Assets (via Blob Store)
       └─ optional Campaign Deliverable link
```

Tables: `dynaxis_compositions`, `dynaxis_composition_revisions`, `dynaxis_composition_exports`, `dynaxis_asset_derivations`.  
Campaign deliverables may set `composition_id`, `final_asset_id` (original `asset_id` preserved).

---

## Document schema (version 1)

Zod-validated JSON — not React state:

- `canvas` — width/height, background, safe area
- `background` — Asset reference or solid colour
- `layers[]` — `text` | `image` | `component_instance` (Phase 6H)
- optional `guides` / `editorPrefs`

Layer roles: `headline`, `body`, `cta`, `brand_logo`, `product`, `character`, `decorative`, `custom`.

---

## Export pipeline

1. Validate document + resolve owned image Assets  
2. Build deterministic SVG (shared layout module)  
3. Embed images as data URIs **only inside the ephemeral SVG** (not persisted)  
4. Rasterize server-side with `@resvg/resvg-js` → PNG  
5. Validate PNG (signature, size, checksum)  
6. Upload via Asset Blob Store (`memory` / `filesystem` / `s3`)  
7. Register PNG as Dynaxis Asset (`provider: dynaxis-composition`) — durable URL or `dynaxis-blob://`  
8. Record export + asset derivations  

Not an AI Generation — no MuAPI/Resvg posing as a model.  
**Do not** persist exported PNG bytes as `data:` URLs in PostgreSQL.

External MuAPI/CDN Asset URLs remain supported for non-managed Assets.

---

## Consumers

| Consumer | Role |
|----------|------|
| **Creative Editor** (`dynaxis.creative-editor`) | Edit Compositions; Save as Template; Adapt aspect; clean-background; export |
| **Design Library** (`dynaxis.design-library`) | Manage Design Templates & Components; instantiate into Compositions |
| **Design Agent** (Studio) | Natural-language → typed Design Operations on the same Composition Document |
| **Campaign Studio** | “Edit in Creative Editor” (± optional Template) on completed deliverables |

Client-safe: `@/lib/dynaxis/compositions`, `@/lib/dynaxis/templates`, `@/lib/dynaxis/design-agent`.  
Server-only: `services/compositions.js`, `services/templates.js`, `services/design-agent.js`, render/storage modules.

Permissions: `compositions:read/write`, `templates:read/write`.

Compositions may record Template provenance (`template_id`, `template_revision_id`) and adaptation lineage. Instantiation and adaptation always create **new** independent documents — no live Template sync. Design Agent edits stamp `metadata.lastEditSource = design_agent`.

---

## Out of scope

Video/animation · collaboration/CRDTs · template marketplace · PDF/SVG download · vector tools · publishing · Skills · Supercomputer · Dynaxis OS.
