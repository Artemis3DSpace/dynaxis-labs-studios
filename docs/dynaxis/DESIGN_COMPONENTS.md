# Dynaxis Design Components

Canonical architecture for reusable **visual Design Components**.

> Design Components are Composition fragments — not React, Vue, HTML, Tailwind, npm, or shadcn-style code components. A future App Builder may map visual Components to code Components deliberately. They are not identical today.

## Hierarchy

```
Brand (optional) → Design System (tokens/modes)
  → Design Components / Component Sets (variants)
    → Design Templates
      → Composition
        → Component Instances (+ ordinary layers + token bindings)
          → Creative Editor / Design Agent
            → Composition Revision
              → Resvg export → Asset
```

The canonical design document remains the **Dynaxis Composition Document**. There is no second canvas document.

## Distinctions

| Entity | Role |
|--------|------|
| **Design Component** | Reusable visual fragment (CTA, card, badge, logo lockup). Intrinsic width/height. |
| **Component revision** | Immutable snapshot of a Component Document + property definitions. |
| **Component property** | Typed exposed control (text / asset / colour / visibility) targeting a known layer. |
| **Component Instance** | Composition layer type `component_instance` that pins `componentId` + `componentRevisionId` and stores overrides only. |
| **Design Template** | Reusable complete design/canvas with slots. May contain pinned Component Instances. |
| **Composition** | Editable design document (layers + optional instances). |
| **React/code component** | Out of scope (Phase 6H/6I). Stable property/variant IDs are future-mapping ready. |
| **Component Set** | Optional grouping of Components under independent variant axes (Phase 6I). See `DESIGN_SYSTEMS.md`. |
| **Variant** | Selectable configuration within a Set — distinct from Component revision history. |

## Component Document

Client-safe Zod schema (`lib/dynaxis/components/document.js`):

- schema version
- intrinsic width / height
- ordered text + image layers only
- property definitions
- metadata / hints (`fitModeDefault`: proportional | stretch)

**Phase 6H forbids nested Component Instances inside Component Documents.**

## Instance pinning

Every instance stores exact:

- `componentId`
- `componentRevisionId`

Rendering never means “load latest”. Historical Composition revisions stay deterministic.

When a newer Component revision exists, the UI/agent may surface **Update available**. Updating is explicit (`updateComponentInstanceRevision`), validates overrides, and surfaces `COMPONENT_OVERRIDE_CONFLICT` when incompatible.

## Overrides

Instances store only differences from the pinned revision. Overrides validate against that revision’s property definitions — no raw JSON paths.

## Shared resolver

`resolveComponentInstance(componentRevision, overrides, placement)` is client-safe and shared by:

- Creative Editor preview
- Design Agent inspection
- SVG / Resvg export
- Adaptation (instances treated as atomic layout units)

## Create / edit / detach

- **Create from layers** — select layers → Create Component → optional replace with instance
- **Edit master** — Creative Editor `mode=component` → save creates a **new** revision
- **Insert** — Design Library / Creative Editor / Design Agent (discovered IDs only)
- **Detach** — expand to ordinary layers; source Component unchanged

## Templates & Campaigns

Templates may contain Component Instances (pinned). Template slots may bind into Component properties via explicit mapping:

`targetComponentInstanceLayerId` + `targetPropertyId`

Campaign → Template instantiation flows through the same binding + Component validation.

## Security

Owner-scoped Components; Asset overrides must be owned images; expanded content uses the same SVG/text/colour/font protections as ordinary layers. Archived Components leave existing pinned revisions resolvable.

## Permissions

- `components:read`
- `components:write`

Design Agent: read + Composition write via operations; **no Component master write by default**.

## Out of scope (6H)

- Variants
- Auto Layout
- Nested Components
- Motion
- Arbitrary vectors
- React/code export
- Marketplace
