# Dynaxis Campaign System

**Canonical architecture** for persistent Campaigns, concepts, formats, and multi-format deliverables in Dynaxis Labs Studios.  
**Phase introduction:** `PHASE_6D_CAMPAIGN_SYSTEM.md`

---

## Distinctions (non-negotiable)

| Entity | What it is | What it is not |
|--------|------------|----------------|
| **Campaign** | Project-scoped creative programme pinned to a Brand revision | A Brand, Product, Character, Project, Asset, or Generation |
| **Concept** | One of four creative directions under a Campaign | A finished deliverable or publishable post |
| **Format** | Creative specification (aspect, copy limits, composition) | A publishing account or social connection |
| **Deliverable** | Format-bound copy + optional image Generation/Asset | A calendar entry or published post |
| **Brand** | Required identity/DNA source for Campaign creation | Optional for Campaigns (it is required) |
| **Product / Character** | Optional pinned participants | Substitutes for Brand |

---

## Domain model

```text
Owner (owner_ref)
  └─ Project
       └─ Campaign
            ├─ Brand revision (required pin)
            ├─ Optional Product revision links
            ├─ Optional Character revision links
            ├─ Campaign Revisions (immutable brief + link snapshots)
            ├─ Concepts (exactly four on generate; one selected)
            ├─ Deliverables (per selected formats)
            └─ Campaign ↔ Assets (roles: reference / result / …)
```

Continuity: **revision pins** on Brand (required) and Product/Character (optional).  
No Campaign↔Projects M:N — a Campaign belongs to exactly one Project.

---

## Goals (typed registry)

`product_launch` · `lead_generation` · `brand_awareness` · `engagement` · `thought_leadership` · `sales`

Code: `lib/dynaxis/campaigns/goals.js` — not stored as freeform enums in DB beyond the chosen string.

---

## Formats (typed registry)

Eight creative specs (not accounts):

`instagram_square` · `instagram_story` · `linkedin_post` · `facebook_ad` · `twitter_post` · `web_banner` · `email_banner` · `youtube_thumb`

Each defines aspect ratio, headline/body/CTA word limits, copy tone, and image composition guidance.

---

## Concepts

- Generate **exactly four** Zod-validated drafts (`CONCEPT_COUNT = 4`)
- Fields: title, theme, keyMessage, hook, cta, recommendedFormatIds, toneNotes, visualDirection
- User direction and scraped/LLM text are delimited as **untrusted data** in prompts
- User must **select** a concept before format planning / paid image work

---

## Deliverables

Statuses: `planned` → `copy_ready` → `generating` → `completed` | `failed` | `cancelled`

1. Plan deliverables for chosen format IDs  
2. Generate structured copy (LLM boundary; format-enforced)  
3. Prepare image `generationRequest` (no raw MuAPI in Campaign service)  
4. Host/runtime creates Generation/Job → Asset  
5. Complete or fail per deliverable; batch allows **partial success**; retry failed only  

Video modality is reserved in schema (`output_modality`) without a video generator in Phase 6D.

---

## Provenance

Generations may record `campaignId` / `campaignRevisionId` alongside Brand / Product / Character pins.  
Reference image order: product → character → brand logo (if `includeBrandLogo`) → brand refs → campaign refs (budget-clamped).

---

## Consumers

| Consumer | Role |
|----------|------|
| **Campaign Studio** (`dynaxis.campaign-studio`) | Brief → concepts → formats → deliverables → results (± optional Design Template) |
| **Creative Editor** (`dynaxis.creative-editor`) | Non-destructive edit + PNG export; opens from completed deliverables |
| **Design Library** (`dynaxis.design-library`) | Reusable Templates for deliverable layout (see `DESIGN_LIBRARY.md`) |
| **Campaign Consumer** | `resolveCampaignContext` for messaging/visual projection |

Client-safe: `@/lib/dynaxis/campaigns` (goals, formats, concepts, copy, references, consumer).  
Never import `services/campaigns.js` from the browser graph.

---

## APIs

`/api/dynaxis/campaigns/*` — CRUD, revisions, products/characters links, concepts, deliverables, assets.

Permissions: `campaigns:read`, `campaigns:write` (Campaign Studio may also request `templates:read`).

---

## Out of scope

Social publishing · calendars · scheduling · Skills · Supercomputer · Dynaxis OS · Pomelli SQLite/Prisma merge · Campaign↔Projects M:N.

Creative editing: `COMPOSITION_SYSTEM.md` (Phase 6E).  
Design Templates: `DESIGN_LIBRARY.md` (Phase 6F).  
Design Components in Templates/Campaigns: `DESIGN_COMPONENTS.md` (Phase 6H).  
Design Systems / variants in Template→Campaign path: `DESIGN_SYSTEMS.md` (Phase 6I).
