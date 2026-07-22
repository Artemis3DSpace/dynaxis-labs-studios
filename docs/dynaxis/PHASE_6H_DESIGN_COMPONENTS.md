# Phase 6H — Design Components + Component Library

Status: implemented.

## Domain

Persistent owner-scoped Design Components with immutable revisions, Composition `component_instance` layers, controlled property overrides, shared resolver, Design Library Components view, Creative Editor component mode, Template/Campaign binding, adaptation atomicity, and Design Agent discovery/ops.

## Database (migration `0007_dynaxis_design_components`)

- `dynaxis_design_components`
- `dynaxis_design_component_revisions`
- `dynaxis_composition_component_instances` — dependency index for usage / update-available (Composition Document remains canonical)

## Component Document & properties

- `lib/dynaxis/components/document.js`
- `lib/dynaxis/components/properties.js` — text | asset | colour | visibility
- Nested instances rejected
- Override validation + `evaluateComponentRevisionUpdate` / `COMPONENT_OVERRIDE_CONFLICT`

## Instance resolver & rendering

- `lib/dynaxis/components/resolver.js` — `resolveComponentInstance`, `expandCompositionDocument`
- Export expands pinned revisions before SVG → Resvg
- Missing revision → `COMPONENT_REVISION_UNAVAILABLE`

## Service / APIs

- `lib/dynaxis/services/components.js`
- `/api/dynaxis/design-components/*` (list/create/archive/revisions/thumbnail/usage/from-layers/instantiate/detach/update-instance-revision)
- Permissions: `components:read` / `components:write`

## Creative Editor

Modes: composition | template | **component**

- Create Component from selected layers (explicit replace confirm)
- Insert / Detach / Update available
- Component mode: intrinsic canvas; no nested instances; save → new revision

## Design Library

Templates | Components toggle — search, category, archive, edit in Creative Editor.

## Templates / Campaign / Adaptation

- Template Documents may include Component Instances (pinned)
- Slot → Component property via explicit mapping fields
- Adaptation treats instances as atomic units (preserve pin + overrides)

## Design Agent

Ops: `insert_component_instance`, `update_component_instance_overrides`, `update_component_instance_revision`, `detach_component_instance` (+ existing move/resize).

Discovery via `listRelevantComponents` — hallucinated Component IDs rejected (`DESIGN_COMPONENT_NOT_APPROVED`). No master rewrite by default.

## Legacy audits

### design-agent package

- Removed from `packages/studio` dependency
- Removed from Next `transpilePackages`
- Removed from root `build:packages` chain (`build:design` script retained for optional package builds)
- Source package kept in workspaces; Open-AI-Design-Agent client may still use it
- Studio Design Agent no longer imports `CreativeCanvas`

### Session token mirror

- `lib/dynaxis/session.js` may still mirror API key to `token` (`DYNAXIS_PRODUCT.session.designAgentTokenKey`)
- Design Agent Studio (Phase 6G+) does **not** read/write this for auth
- Remaining consumers: legacy MuAPI / CreativeCanvas surfaces outside Dynaxis Composition path

## Tests

`tests/dynaxis-design-components.test.mjs` + boundary graph includes `components/*`.

## Explicitly not built

Variants · Auto Layout · nested Components · React/code components · marketplace · Skills · Supercomputer · Dynaxis OS
