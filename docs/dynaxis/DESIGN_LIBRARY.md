# Dynaxis Design Library

**Canonical architecture** for Design Templates, Design Components, Design Systems, semantic slots, binding, instantiation, and multi-aspect adaptation.  
**Phase introduction:** `PHASE_6F_DESIGN_LIBRARY.md`  
**Components:** `DESIGN_COMPONENTS.md` · `PHASE_6H_DESIGN_COMPONENTS.md`  
**Design Systems:** `DESIGN_SYSTEMS.md` · `PHASE_6I_DESIGN_SYSTEMS.md`  
**Composition foundation:** `COMPOSITION_SYSTEM.md`

---

## Distinctions

| Entity | What it is | What it is not |
|--------|------------|----------------|
| **Design Template** | Owner-scoped reusable complete canvas | An Asset, Composition, Campaign, or marketplace listing |
| **Design Component** | Owner-scoped reusable visual fragment | A Template, React/npm component, or Asset |
| **Design System** | Owner-scoped token implementation (optional Brand link) | A Brand, Template, or CSS file — see `DESIGN_SYSTEMS.md` |
| **Component Set** | Variant axes + sparse Component revision mappings | A Component revision history |
| **Template revision** | Immutable document + slots snapshot | A live linked Component |
| **Component revision** | Immutable Component Document + properties | Auto-propagating master |
| **Slot** | Explicit semantic replacement point on Templates | Inferred layer-name magic |
| **Component property** | Typed instance override surface | Arbitrary JSON path |
| **Instantiation** | Snapshot → new independent Composition | Live sync / master instance |
| **Adaptation** | Deterministic smart starting layout | AI art direction / Figma Auto Layout |

Editing a Composition never mutates its source Template.  
Later Template revisions never propagate into existing Compositions.

---

## Domain model

```text
Owner
  └─ Design Template (reusable across Projects)
       ├─ metadata (name, category, tags, status, optional Brand binding)
       ├─ optional thumbnail Asset
       └─ Template revisions (immutable)
            ├─ Template Document (layers + slots + adaptation hints)
            └─ instantiate(binding) → Composition (+ template provenance)
```

Tables: `dynaxis_design_templates`, `dynaxis_design_template_revisions`.  
Compositions may record `template_id`, `template_revision_id`, and adaptation lineage fields.

---

## Template Document (version 1)

Zod-validated — reuses Composition layer primitives (`text` / `image`):

- `canvas`, `background`, `layers[]` — same safety rules as Composition Document
- `slots[]` — typed text/image slots with stable IDs and target layer/background
- optional `adaptationHints`, `brandHints`, `formatMetadata`

Compile path:

```text
Template Document → bind slots → Composition Document → existing preview/render/export
```

No Template-specific renderer.

---

## Semantic slots

### Text roles

`headline` · `body` · `cta` · `eyebrow` · `custom_text`

### Image roles

`background` · `product` · `character` · `brand_logo` · `brand_reference` · `custom_image`

Each slot: stable ID, type, role, required/optional, target layer (or background), default/fallback, optional constraints.

---

## Binding precedence

Deterministic — never silent unexpected media:

| Slot | Order |
|------|--------|
| **Headline / body / CTA** | Explicit user value → Campaign Deliverable copy → Template default |
| **Brand logo** | Explicit Asset → Brand `primary_logo` → Template default → empty if optional |
| **Product** | Explicit Asset → Product primary reference → Template default |
| **Character** | Explicit Asset → Character `identity_reference` → Template default |
| **Background** | Explicit Asset → deliverable/generated Asset → Template default |

Required slots that cannot be fulfilled fail with `TEMPLATE_REQUIRED_SLOT_MISSING` / `TEMPLATE_ASSET_UNAVAILABLE`.  
Optional slots may remain empty. Cross-owner Assets are rejected.

---

## Instantiation

```text
Template revision + TemplateBindingContext
  → bindTemplateSlots (pure)
  → validate owned Assets
  → create dynaxis_compositions (independent)
  → provenance: template_id + template_revision_id
```

---

## Multi-aspect adaptation

Pure engine: `adaptCompositionDocument(document, sourceCanvas, targetCanvas, rules)`.

- Reuses Campaign format registry aspects (`1:1`, `9:16`, `16:9`, …)
- Optional layer `adaptation` hints (anchors, scale behaviour, priority, safe-area preference)
- Safe areas are **format guidance**, not hard render constraints
- Emits warnings (`TEXT_OVERFLOW_RISK`, `LAYER_OUTSIDE_SAFE_AREA`, `LAYER_COLLISION`, `IMAGE_CROP_CHANGED`, `OPTIONAL_LAYER_OMITTED`)
- Creates a **new** Composition; source unchanged
- Batch adaptation supports partial success

Honest UX: adapted output is a **starting layout**, not perfect responsive design.

---

## Surfaces

| Surface | Role |
|---------|------|
| **Design Library** (`dynaxis.design-library`) | List / instantiate / archive Templates **and** Components |
| **Creative Editor** | Save as Template; Template / Component modes; Create/Insert/Detach Component |
| **Design Agent** | May list Templates & Components; edits resulting Composition only (no Component master write by default) |
| **Campaign Studio** | Optional Template on deliverable → Creative Editor |

Permissions: `templates:read/write`, `components:read/write` (Design Templates & Components — not React/Prompt templates).

See also: `DESIGN_COMPONENTS.md` · `PHASE_6H_DESIGN_COMPONENTS.md`.

---

## Deferred

- Marketplace, publishing, import/export (Figma/PSD/Canva)
- External registries (21st.dev, Aura, shadcn)
- Design Token database (Brand already holds palette/fonts)
- Component variants / nested Components / Auto Layout
- Skills / Supercomputer / Dynaxis OS

Future Design Blocks/Components must map into Template/Composition layers without a parallel renderer.
