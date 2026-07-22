# Dynaxis Brand System

**Canonical architecture** for persistent Brands and Brand DNA in Dynaxis Labs Studios.  
**Phase introduction:** `PHASE_6C_BRAND_SYSTEM.md`

---

## Distinctions (non-negotiable)

| Entity | What it is | What it is not |
|--------|------------|----------------|
| **Brand** | Owner-scoped creative identity + communication/visual rules (DNA) | A Product, Project, Asset, Campaign, or Generation |
| **Product** | Commercial/creative product identity that *may* link to a Brand | Not a substitute for Brand DNA |
| **Character** | Persistent persona / visual identity for presenters | Not Brand messaging |
| **Project** | Workspace that may *link* many Brands | Brand owner (owner is `owner_ref`) |
| **Asset** | Stored media (logo, screenshot, references) | Brand identity itself |
| **Generation** | One creative run; may record Brand + Brand revision provenance | The Brand |
| **Campaign** | Project-scoped creative programme pinned to a Brand revision | Not a Brand substitute; see `CAMPAIGN_SYSTEM.md` |
| **Design Template** | Reusable layout blueprint that may be Brand-neutral or Brand-bound | Not a Design Token database; see `DESIGN_LIBRARY.md` |
| **Design System** | Optional Brand-associated implementation tokens/modes | Not Brand DNA; seed is COPY — see `DESIGN_SYSTEMS.md` |

---

## Domain model

```text
Owner (owner_ref)
  └─ Brand Library
       └─ Brand
            ├─ Brand Revisions (immutable DNA snapshots)
            ├─ Brand ↔ Assets (primary_logo, brand_screenshot, …)
            ├─ Brand ↔ Products (M:N; primary preferred)
            └─ Brand ↔ Projects (M:N links)
```

Continuity strategy: **reference-based** (`BRAND_CONTINUITY_STRATEGY`).

Conceptual hierarchy:

`Owner` → `Brand Library` → `Brand` → Products / creative work.

---

## Brand DNA

Structured (not one opaque blob):

- Identity: name, industry, tagline, value proposition, target audience, imagery/layout style, source URL
- Messaging collections: tone of voice, personality, key messages
- Visual collections: primary/secondary colours (`#rrggbb`), fonts (family names only)

Derived contexts for consumers:

- **BrandMessagingContext** — copy/LLM guidance
- **BrandVisualContext** — colours, fonts, styles, logo/reference Assets

Do not dump the full Brand row into every model prompt.

---

## Creation paths

1. **Manual** — first-class; no website required  
2. **Website analysis** — secure server scrape → text + vision + CSS/font evidence → editable draft → user approval → Brand + revision (+ optional Assets)

AI extraction is assistance, not truth. Saving always creates a new immutable revision when DNA changes.

---

## Security

- All Brand APIs verify `owner_ref`
- Website analysis is server-only (`server-only` scraper/analyzer)
- SSRF: scheme allowlist, blocked hosts, private/reserved IP rejection, DNS validation, redirect/subresource gating
- Scraped text is untrusted DATA; prompts forbid following embedded instructions
- Mini Apps do **not** receive `external:network` for Brand analysis — they call `/api/dynaxis/brands/analyze`

---

## Consumers

| Consumer | Brand use |
|----------|-----------|
| **Brand Studio** (`dynaxis.brand-studio`) | Create / edit / analyze / attach Assets |
| **Product Studio** | Optional Brand ↔ Product link; optional logo reference |
| **Marketing Studio** | Optional BrandPicker; messaging supplement; optional logo in image budget |
| **Campaign Studio** | Required Brand revision pin for Campaign brief + DNA contexts |

Shared client picker: `packages/studio/src/components/brand/BrandPicker.jsx`.

---

## APIs

`/api/dynaxis/brands/*` — CRUD, assets, projects, products, revisions, analyze  
`/api/dynaxis/products/:id/brands` — Product ↔ Brand links  

Client SDK: `createPlatformClient(apiKey).*Brand*` methods.  
Client-safe modules: `@/lib/dynaxis/brands` (colors, dna, consumer) — never scraper/analyzer/url-security.

---

## Out of scope (Phase 6C)

Canvas editor, social publishing, Open Pomelli SQLite/Prisma/Assets/Photoshoot/Animation models, Skills, Supercomputer, Dynaxis OS.  
Campaigns are delivered in Phase 6D — see `CAMPAIGN_SYSTEM.md`.
