# Phase 6D — Campaign System + Multi-Format Creative Sets

**Status:** Complete  
**Canonical:** `CAMPAIGN_SYSTEM.md`  
**Source mined (not merged):** `SamurAIGPT/Open-Pomelli`

---

## 1. Open Pomelli audit

Inspected campaign goals, concept generator (four concepts), platform-format packs, copy-then-image flow, asset/photo/animation modules, Prisma campaign-related models, and calendar/publishing surfaces.

### MIGRATE

- Goal vocabulary (six campaign goals)
- Four-concept creative exploration pattern
- Platform format creative specs (aspect, copy limits, composition)
- Copy-then-image sequencing
- Brand-led brief + optional product/persona participation (as Dynaxis Product/Character)

### ADAPT

- Persistence → PostgreSQL + Drizzle (`dynaxis_campaigns*`), not SQLite/Prisma
- Concepts / deliverables → Dynaxis domain tables + Zod validation
- Media → Dynaxis Generation / Job / Asset lifecycle (no vendored MuAPI client)
- Studio → Mini App `dynaxis.campaign-studio` using locked Dynaxis shell patterns
- Format IDs → Dynaxis typed registry (`formats.js`)

### DEFER

- Canvas asset editor
- Social publishing / account connections
- Campaign calendar / scheduling
- Photoshoot / Animation as separate domains
- Video deliverable generation (schema-ready only)

### DISCARD

- Auth-less single-tenant SQLite app shell
- Prisma schema / stringified array storage
- Nested iframe / nested app embedding
- Treating formats as publishing accounts
- Autonomous agent/supercomputer campaign planning

---

## 2. Schema / migration

Migration: `drizzle/0004_dynaxis_campaigns.sql`

Tables:

- `dynaxis_campaigns`
- `dynaxis_campaign_revisions`
- `dynaxis_campaign_products`
- `dynaxis_campaign_characters`
- `dynaxis_campaign_concepts`
- `dynaxis_campaign_deliverables`
- `dynaxis_campaign_assets`
- Generation columns: `campaign_id`, `campaign_revision_id`

Stores: `campaign-memory.js`, `campaign-postgres.js` via platform store.

Revision snapshot shape:

```text
{ reason, brief: { name, goal, direction, status, includeBrandLogo, brandId, brandRevisionId, selectedConceptId, projectId }, products[], characters[] }
```

---

## 3. Service + APIs

`lib/dynaxis/services/campaigns.js` — create/get/list/update/archive; revisions; product/character links; concept generate/select/edit; deliverable plan/copy/prepareImage/complete/fail; assets.

Routes under `/api/dynaxis/campaigns/*`.

Permissions: `campaigns:read`, `campaigns:write`.

Injectable `textFn` on concept/copy generation for tests; production uses MuAPI LLM chat boundary.

---

## 4. Goals, formats, concepts, copy

| Module | Role |
|--------|------|
| `campaigns/goals.js` | Six goal IDs + helpers |
| `campaigns/formats.js` | Eight format specs + word-limit validation/mapping |
| `campaigns/concepts.js` | Prompt builders, JSON parse, Zod (exactly four), injection delimiting |
| `campaigns/copy.js` | Format-aware copy enforce/truncate |
| `campaigns/references.js` | Ordered reference budget |
| `campaigns/consumer.js` | Runtime Campaign context projection |

---

## 5. Campaign Studio

Mini App `dynaxis.campaign-studio`:

1. **Brief** — Project + Brand revision required; optional Products/Characters; direction; logo toggle  
2. **Concepts** — generate four → edit → select one  
3. **Formats** — explicit multi-select before image spend  
4. **Deliverables** — copy then prepare image Generation  
5. **Results** — Assets / status / retry failed  

Headless capabilities include `createCampaign`, `generateCampaignConcepts`, `selectCampaignConcept`, `createCampaignDeliverables`, `generateCampaignDeliverable`, `generateCampaignDeliverableBatch`, `attachCampaignAsset`, `listGoals`, `listFormats`.

Feature flags: `noCanvas`, `noPublishing`.

---

## 6. Provenance + lifecycle

- Pins: Brand (required), Product/Character (optional), Campaign + Campaign revision on Generations  
- `generateCampaignDeliverableImage` returns a Dynaxis `generationRequest` only  
- Complete/fail update deliverable + optional `dynaxis_campaign_assets` result link  
- Partial batch success; retry does not re-run completed siblings  

---

## 7. Tests

`tests/dynaxis-campaigns.test.mjs` — domain, concepts, formats/copy, deliverables, references, combinations, Studio manifest.  
`tests/dynaxis-boundary.test.mjs` — client includes `campaigns/consumer.js`; excludes `services/campaigns.js`.

---

## 8. Explicitly not done

Canvas editor, social publishing, calendars, scheduling, Skills, Supercomputer, Dynaxis OS, Pomelli SQLite/Prisma merge, video deliverable execution, UI redesign.
