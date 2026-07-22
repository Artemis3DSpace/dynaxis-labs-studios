# Phase 6C — Persistent Brand System + Brand DNA

**Status:** Complete  
**Canonical:** `BRAND_SYSTEM.md`  
**Source mined (not merged):** `SamurAIGPT/Open-Pomelli`

---

## 1. Open Pomelli audit

Inspected Prisma BrandDNA-related models, `brand-analyzer.ts`, scraper, colour extraction, MuAPI client, Brand UI/editing, website analysis routes, campaign/asset/photo/animation/platform-format modules.

### MIGRATE

- Brand DNA field concepts (name, industry, tagline, value prop, tone, personality, audience, key messages, colours, fonts, imagery/layout style, logo, screenshot)
- High-level pipeline: scrape → text analysis + vision + CSS colours/fonts → merge → editable DNA
- Deterministic colour normalisation / palette ranking ideas

### ADAPT

- DNA merge → typed Zod drafts + Dynaxis LLM/vision boundary
- Scraper → Playwright with SSRF request/navigation gates + resource limits
- Brand persistence → PostgreSQL + Drizzle (`dynaxis_brands*`), not SQLite/Prisma
- Media → Dynaxis Assets + `dynaxis_brand_assets`
- Studio → Dynaxis Mini App (`dynaxis.brand-studio`) using shell design patterns

### DEFER

- Campaigns / goals / concepts / calendars
- Canvas asset editor
- Social publishing
- Photoshoot / Animation as separate domains
- Platform-format packs as first-class Brand features

### DISCARD

- Auth-less single-tenant SQLite app shell
- Prisma schema / stringified array storage
- Vendored MuAPI client and Brand-specific API keys
- Nested iframe / nested app embedding
- Granting Mini Apps raw `external:network` for scraping

---

## 2. Schema / migration

Migration: `drizzle/0003_dynaxis_brands.sql`

Tables:

- `dynaxis_brands`
- `dynaxis_brand_revisions`
- `dynaxis_brand_assets`
- `dynaxis_brand_products`
- `dynaxis_project_brands`
- Generation columns: `brand_id`, `brand_revision_id`

Stores: `brand-memory.js`, `brand-postgres.js` via platform store.

---

## 3. Service + APIs

`lib/dynaxis/services/brands.js` — create/get/list/update/archive, revisions, assets, project/product links.

Routes under `/api/dynaxis/brands/*` + `/api/dynaxis/products/[id]/brands`.

Permissions: `brands:read`, `brands:write`.

---

## 4. Website analyzer + SSRF

| Module | Role |
|--------|------|
| `brands/url-security.js` | Scheme/host/IP/DNS/redirect validation |
| `brands/scraper.js` | server-only Playwright; route abort; `finally` cleanup |
| `brands/analyzer.js` | server-only scrape + LLM text + vision + merge |
| `brands/colors.js` / `dna.js` | Deterministic colours/fonts + Zod merge |
| `POST /api/dynaxis/brands/analyze` | Controlled analysis endpoint |

**Browser deployment:** Playwright is an optional server dependency. If Chromium is unavailable, analysis returns `BRAND_SCRAPER_UNAVAILABLE` (503); manual Brand create/edit still works. Do not bundle Playwright into client.

**Security approach:** validate URL → resolve DNS → launch browser → intercept requests/nav → re-validate final URL → extract → close browser in `finally`. Scraped content delimited as untrusted in prompts.

---

## 5. Brand Studio

Mini App `dynaxis.brand-studio`:

- Manual create / edit → new revision
- Analyze URL → draft review → save
- Asset list for logos/references
- Headless capabilities: `createBrand`, `updateBrand`, `analyzeBrandWebsite`, `saveBrandDraft`, `attachBrandAsset`, `linkProductToBrand`, `resolveBrandContext`

No `external:network` permission.

---

## 6. Product + Marketing integration

- **Product Studio:** optional Brand selector + link; optional logo as generation reference; Brand ID/revision on Generation when used
- **Marketing Studio:** shared `BrandPicker`; messaging supplement; optional logo in combined ≤9 image budget (order: product → avatar → brand logo → creative); provenance fields

Existing Product `brandName` string remains compatibility metadata — no auto-link by text match.

---

## 7. Tests

`tests/dynaxis-brands.test.mjs` — domain, DNA, SSRF suite, browser cleanup mocks, Brand Studio, Marketing budget.  
`tests/dynaxis-boundary.test.mjs` — client graph excludes scraper/analyzer/url-security.

---

## 8. Explicitly not done

Campaigns, canvas editor, social publishing, Pomelli Asset/Photoshoot/Animation DBs, Skills, Supercomputer, Dynaxis OS, UI redesign.
