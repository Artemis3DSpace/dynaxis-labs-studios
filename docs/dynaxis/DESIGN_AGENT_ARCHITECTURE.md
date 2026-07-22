# Dynaxis Design Agent Architecture

**Canonical architecture** for Design Agent as a Composition controller.  
**Phase introduction:** `PHASE_6G_DESIGN_AGENT_BRIDGE.md`  
**Composition:** `COMPOSITION_SYSTEM.md` · **Templates:** `DESIGN_LIBRARY.md` · **Components:** `DESIGN_COMPONENTS.md` · **Design Systems:** `DESIGN_SYSTEMS.md`

---

## Authority model (absolute)

| Role | Owns |
|------|------|
| **Design Agent** | Natural-language reasoning → typed Design Action Plans |
| **Composition Document** | Canonical editable design document |
| **Creative Editor** | Deterministic human editing + local undo |
| **Design Library** | Reusable Templates + Components + Design Systems |
| **Resvg export** | Canonical PNG rendering |

There is **no** persistent Konva / CreativeCanvas document.  
There is **no** live `Composition ↔ Konva` synchronisation.

---

## Flow

```text
User request
  → Design Agent LLM (server provider boundary)
  → Design Action Plan (Zod)
  → DesignOperationBatch (atomic, versioned)
  → applyDesignOperations (pure)
  → Composition Service draft update
  → Composition preview (same document as Creative Editor)
  → optional Save revision / Export PNG
```

AI imagery:

```text
prepareImageGeneration → Generation → Job → Asset
  → attachGeneratedAsset (deterministic Composition op)
```

Templates:

```text
Design Library → instantiate → Composition → Design Agent → Creative Editor
```

---

## Design Operations

Client-safe: `lib/dynaxis/design-agent/operations.js`

- Discriminated union of typed ops (text/image/layer/canvas)
- No `setRawDocument`, no JS/CSS/HTML execution
- Max `DESIGN_AGENT_MAX_OPERATIONS` (48) per batch
- Locked layers reject mutation unless `set_locked`
- Hallucinated Asset IDs rejected (`DESIGN_ASSET_NOT_APPROVED` / not found)
- Hallucinated Component IDs rejected (`DESIGN_COMPONENT_NOT_APPROVED`)
- Component ops: insert / override / explicit revision update / detach (no Component master write by default)

Optimistic concurrency: batch carries `documentVersion`. Stale plans return `DESIGN_AGENT_STALE_COMPOSITION`.

---

## Surfaces

| Surface | Behaviour |
|---------|-----------|
| **Design Agent Studio** | Composition picker + chat plan/apply + Composition preview |
| **Creative Editor** | Open same Composition — no conversion |
| **Design Library** | Templates + Components remain explicit; Agent does not mutate Template/Component masters by default |

---

## Auth / credentials

- Platform ownership via Dynaxis API key → `owner_ref`
- Design Agent Studio does **not** write `localStorage.token`
- MuAPI balance is **not** Design Agent authorization
- LLM / Generation credentials stay server-side
- `lib/dynaxis/session.js` may still mirror the API key to `token` for unrelated MuAPI/CreativeCanvas surfaces; Design Agent Studio does not depend on it

`sessionStorage.fromDesignAgent` may remain for shell tab navigation only.

---

## Cross-Project Assets

Owner-scoped Brand/Product/Character Assets may bind across Projects of the same owner (e.g. Brand logos). Ephemeral Project-local Assets should not be silently reused without ownership checks. Asset IDs remain opaque platform identifiers.
