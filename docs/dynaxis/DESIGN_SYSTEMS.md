# Dynaxis Design Systems

Canonical architecture for Design Systems, Design Tokens, Modes, and Component Sets (Phase 6I).

## Hierarchy

```
Brand (identity / creative guidance)
  → optional Design System (implementation rules) — COPY seed, not live sync
    → immutable Design System revision
      → token collections + modes
      → primitive tokens + semantic aliases
→ Design Components / Component Sets (variants)
→ Design Templates
→ Composition
→ Creative Editor / Design Agent
→ deterministic export (SVG → Resvg)
```

Brand ≠ Design System. Brand Studio remains authoritative for identity and messaging. Design Systems encode reusable implementation decisions (colours, type scale, spacing numbers the renderer can express).

## Entities

| Concept | Meaning |
| --- | --- |
| **Brand** | Identity, messaging, visual guidance |
| **Design System** | Owner-scoped reusable token implementation; optional Brand association |
| **Design System revision** | Immutable validated Token Document |
| **Token** | Stable opaque ID + primitive type (colour \| number \| string \| boolean) |
| **Semantic token** | Usually an alias of a primitive (e.g. `action.primary` → brand blue) |
| **Alias** | Token → token ID of the same type; cycles rejected (`DESIGN_TOKEN_ALIAS_CYCLE`) |
| **Collection** | Named group of modes + tokens |
| **Mode** | Named value context (Light/Dark/…). Not breakpoints / media queries |
| **Component** | Reusable visual fragment (not React/npm) |
| **Component Set** | Optional grouping with independent variant axes |
| **Variant** | Explicit sparse combination → pinned Component revision (≠ revision history) |
| **Template** | Blueprint that may pin Design System + Component Set variants |
| **Composition** | Canonical editable document; may pin Design System revision + modes |

## Token Document

Client-safe Zod schema (`lib/dynaxis/design-systems/document.js`):

- `version`, `collections[]`, `tokens[]`, `metadata`
- Bindings reference **`tokenId`**, never display names
- Unsupported renderer domains (blur, complex shadows, gradients, motion) are not operational

## Resolution

Pure `resolveDesignToken(tokenDocument, tokenId, modeContext)`:

1. Follow aliases (type-safe, cycle-detecting)
2. Requested mode → collection default mode → token `defaultValue`
3. Surface `DESIGN_TOKEN_MODE_FALLBACK` warnings

Bindings (`tokenBindings` on layers/canvas) keep literal fields as fallback. Detach materializes the resolved value and removes the binding.

## Rendering pipeline

```
Composition
  → pinned Design System revision
  → mode resolution
  → apply token bindings
  → Component Instance / variant expansion
  → SVG → Resvg → Asset
```

Preview and export share the same pure resolver.

## Component Sets

- Independent axes (style, size, state…) — not monolithic strings
- Sparse mappings only; missing combo → `COMPONENT_VARIANT_UNAVAILABLE`
- Default combination is explicit (never first DB row)
- Switch variant ≠ update Component revision
- Compatible overrides preserved; incompatible → `COMPONENT_OVERRIDE_CONFLICT`

Standalone Components remain first-class without Sets.

## Modes vs variants

Design System **modes** switch token values. Component **variants** switch structural Component revisions. No automatic coupling in Phase 6I.

## Permissions

- `designSystems:read` / `designSystems:write`
- `componentSets:read` / `componentSets:write`

Creative Editor: read. Design Library: read/write. Design Agent: read tokens/sets; Composition write via typed ops; **no Design System master write by default**.

## Boundaries

**Client-safe:** token schema, resolver, bindings, Component Set variant helpers.

**Server-only:** Design System / Component Set services, Drizzle, ownership.

**Deferred:** Auto Layout (6J), responsive constraints, React/code components, marketplace, Skills, Supercomputer, Dynaxis OS.

## Related docs

- `PHASE_6I_DESIGN_SYSTEMS.md`
- `DESIGN_COMPONENTS.md`
- `DESIGN_LIBRARY.md`
- `COMPOSITION_SYSTEM.md`
- `DESIGN_AGENT_ARCHITECTURE.md`
- `BRAND_SYSTEM.md`
