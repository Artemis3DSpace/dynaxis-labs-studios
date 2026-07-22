# Phase 6I — Design System Tokens + Modes + Component Variants

Status: implemented.

## Phase 6H risk audit (pre-work)

### Component Asset ownership on export

`requireImageAsset` in Composition export allows same-owner Assets from other Projects (Brand / Product / Character identity Assets). Owner authorization is never weakened; cross-owner Assets remain rejected. Project mismatch alone is not a hard fail for owner-scoped persistent identity Assets.

### Dependency index sync

`dynaxis_composition_component_instances` is synchronized on Composition draft save, revision save, instance insert/detach/revision update, create-from-layers replace, **Template instantiation**, and **adaptation**. The Composition Document remains authoritative; the index is derived.

## Domain

### Design Systems

Migration `0008_dynaxis_design_systems`:

- `dynaxis_design_systems` — owner, name, optional Brand / Brand revision, status (`draft` \| `active` \| `archived`), current revision, metadata
- `dynaxis_design_system_revisions` — immutable Token Document JSON
- Composition columns: `design_system_id`, `design_system_revision_id`, `design_system_modes`

### Component Sets

- `dynaxis_design_component_sets` — axes + default combination
- `dynaxis_design_component_set_variants` — sparse combination → Component + revision pins

## Token schema & resolver

- `lib/dynaxis/design-systems/document.js` — colour / number / string / boolean; collections; modes; aliases; cycle detection at parse
- `lib/dynaxis/design-systems/resolver.js` — pure resolve + revision update evaluation
- `lib/dynaxis/design-systems/bindings.js` — `tokenBindings`, apply, detach
- `lib/dynaxis/design-systems/seed-from-brand.js` — Brand visual COPY seed

## Bindings

Optional `tokenBindings` on Composition / Component / Template layers and canvas. Literals remain fallback. Supported properties match current renderer fields only.

Pins:

- Composition row + `document.designSystem`
- Template `designSystem` context (preserved on instantiate)
- Component Document optional `designSystem`

## Component variants

- `lib/dynaxis/component-sets/variants.js`
- Services: `lib/dynaxis/services/component-sets.js`
- Switch reuses 6H override conflict shape
- Template `variant` slots map explicitly to Component Set axes

## Services / APIs

- `lib/dynaxis/services/design-systems.js`
- `/api/dynaxis/design-systems/*` (list/create/[id]/revisions/from-brand)
- `/api/dynaxis/design-component-sets/*` (list/create/[id]/variants/resolve/instantiate/switch-instance)
- Permissions: `designSystems:*`, `componentSets:*`

## Design Agent

Ops: `bind_token`, `detach_token`, `switch_design_mode`, `switch_component_variant`, `insert_component_set_instance`.

Discovery: `listRelevantTokens`, `listRelevantComponentSets`. Hallucinated IDs rejected. No Design System master write by default.

## Rendering

`resolveCompositionTokens` → `applyTokenBindingsToDocument` → `expandCompositionDocument` (with token doc) → SVG → Resvg.

Adaptation preserves Design System pins and token bindings (does not flatten to literals).

## UI (locked shell)

- Design Library: Templates | Components | Design Systems (+ Component Sets listing)
- Creative Editor: minimal bind/detach, mode switch, variant switch

## Tests

`tests/dynaxis-design-systems.test.mjs` + boundary graph includes `design-systems/*` and `component-sets/*`, excludes services.

## Deferred

- Auto Layout / responsive constraints → **Phase 6J**
- React/code components, marketplace, Skills, Supercomputer, Dynaxis OS
