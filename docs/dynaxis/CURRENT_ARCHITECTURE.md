# Dynaxis Labs Studios — Current Architecture (Post Phase 6I)

**Status:** As-built after Phase 6I Design Systems  
**Phase 6F:** `PHASE_6F_DESIGN_LIBRARY.md` · `DESIGN_LIBRARY.md`  
**Phase 6G:** `PHASE_6G_DESIGN_AGENT_BRIDGE.md` · `DESIGN_AGENT_ARCHITECTURE.md`  
**Phase 6H:** `PHASE_6H_DESIGN_COMPONENTS.md` · `DESIGN_COMPONENTS.md`  
**Phase 6I:** `PHASE_6I_DESIGN_SYSTEMS.md` · `DESIGN_SYSTEMS.md`

---

## 1. System context

```text
Dynaxis Shell (UI LOCKED)
  ├─ Design Agent Studio  → typed ops on Composition Document (tokens/modes/variants)
  ├─ Creative Editor      → same Composition Document (+ Template / Component modes)
  ├─ Design Library       → Templates | Components | Design Systems
  ├─ Campaign / Brand / Product / Character Studios
  └─ Other Studios (Headshot, Image, Video, …)
```
  ├─ Design Library       → Templates + Components → Composition
  ├─ Campaign Studio      → Deliverable (± Template) → Composition
  ├─ Asset Blob Store + Resvg export
  └─ /api/dynaxis/design-agent · design-templates · design-components · compositions
```

---

## 2. Design authority

```text
Design Agent (reasons)
  → Design Action Plan
  → Design Operations (atomic, versioned)
  → Composition Document (canonical)
  → Creative Editor / Resvg export
```

Component Instances pin exact revisions; masters update only via explicit revision create.  
No persistent Konva document. No dual live canvas sync.

---

## 3. Client / server boundary

Client: compositions, templates, components (document/properties/resolver/preview), design-agent operations/context.  
Server: services + LLM provider + Resvg + Blob Store.

---

## 4. Not in this architecture yet

Publishing · calendars · video Composition layers · collaboration · marketplace ·  
Component variants / nested Components / Auto Layout · Skills · Supercomputer · Dynaxis OS.
