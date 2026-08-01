# Dynaxis Layout Contracts (Phase 8D Scaffold)

This package provides a scaffold-only contract layer for responsive layout and auto-layout metadata.

## Scope

- Pure domain contracts and validation only.
- Breakpoint sets and viewport ranges.
- Layout containers, spacing tokens, and grid tracks.
- Constraint rules and responsive visibility rules.
- Auto-layout intent validation.
- Component layout metadata intended for future App IR bridging.

## Explicit Non-Goals

- No persistence or migration implementation.
- No browser UI, no visual drag/drop editor, and no rendering engine.
- No app generation or code generation.
- No ProviderConnection or secrets module integration.

## Phase Boundary

This scaffold is intentionally independent from App IR runtime integration. Later phases may connect validated layout metadata into App IR contracts once bridge work packages are assigned.
