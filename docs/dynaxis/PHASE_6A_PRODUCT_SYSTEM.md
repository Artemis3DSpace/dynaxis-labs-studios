# Phase 6A — Persistent Product System + Product Studio

**Status:** Complete  
**Date:** 2026-07-22  
**Canonical domain:** `PRODUCT_SYSTEM.md`

---

## 1. Source audit — `SamurAIGPT/amazon-product-studio`

Inspected clone under `_inspect/amazon-product-studio` (not nested into Dynaxis).

### Verified implementation (not README-only)

| Claim | Verified |
|-------|----------|
| Model `nano-banana-2-edit` | Yes (`src/lib/config.js`, `ai.js`) |
| Up to 14 reference images | Yes (`ai.js` enforces `inputUrls.length > 14`) |
| Seven scene presets | Yes (`src/app/page.js` PRESETS) |
| Custom prompt + aspect ratios | Yes (`1:1`, `4:3`, `3:4`, `16:9`, `9:16`) |
| Resolution / format | Hardcoded `1k` / `jpg` |
| Webhook + polling | Yes — Product-specific; **not** migrated |
| Multi-output | Provider `outputs[]`; Dynaxis registers each Asset |
| Persistent Product entity | **No** — only Prisma `AmazonProductCreation` history |

### MIGRATE

- Multi-image product-reference workflow
- Seven scene preset prompt templates
- Aspect-ratio options
- `nano-banana-2-edit` parameter shape (`images_list`, `aspect_ratio`, `resolution`, `output_format`, `google_search`)
- Preview / multi-output download UX patterns (Dynaxis-styled)

### ADAPT

- Persistence → Dynaxis Products / Assets / Projects
- Generation → Dynaxis Generation + Job lifecycle
- Uploads → Dynaxis Asset registration
- Credentials → existing MuAPI key / owner_ref
- Async completion → existing Dynaxis polling lifecycle (no Product webhooks)

### DISCARD

- NextAuth / Google OAuth / User tables
- Stripe / credit packs / pricing pages
- Standalone Navbar / layout / marketing shell
- Prisma + `AmazonProductCreation`
- Independent MuAPI client + Product-specific webhooks
- Amazon seller / SP-API / marketplace integration (never in scope)

### Webhook evaluation

Upstream webhook delivery improves standalone reliability. Dynaxis already owns durable Jobs + polling. **No Product-specific webhook system** was added. A future *generic* MuAPI webhook → Job completion adapter remains a platform gap (documented, not implemented in 6A).

---

## 2. Delivered architecture

```text
Owner → Product Library → Product → Revisions + Reference Assets
Project ↔ Product (M:N)
Product Studio → Product Context → selected refs → Generation → Job → MuAPI → Assets
Explicit promote → product_reference (new revision)
```

### Schema / migration

`drizzle/0002_dynaxis_products.sql` — products, revisions, product_assets, project_products, generation provenance columns.

### Product Service + APIs

`lib/dynaxis/services/products.js` · `/api/dynaxis/products/*`

### Consumer + pickers

`lib/dynaxis/products/` · `ProductPicker` · `ProductReferencePicker`

### Mini App

`dynaxis.product-studio` — manifest, presets, capability (`generateProductScene`, `generateProductPhotoPack`, `promoteProductReference`, …), UI inside Dynaxis shell.

### Catalogue

Interest/template cards named **Amazon Product Studio** suppressed when Product Studio is integrated. User-facing name: **Product Studio**.

### Marketing Studio audit (no Product rewrite)

`MarketingStudio.jsx` still uses local URL state (`productImage`, `avatarImage`, `additionalImages`) + `localStorage`, not Dynaxis Product entities. Documented as the **likely next Product consumer**. No substantial Marketing integration in Phase 6A.

### Security

Owner-scoped CRUD; unowned Assets rejected; Product ID alone insufficient; Dynaxis-only keys stripped before MuAPI; Phase 5D client boundary includes `products/consumer.js`.

### Tests

`tests/dynaxis-products.test.mjs` (+ boundary graph includes Product consumer).

---

## 3. Deferred (explicit)

- Brand DNA / Brands domain
- Open Pomelli migration
- Marketing Studio Product wiring beyond documentation
- Voice Identity / Skills / Supercomputer / Dynaxis OS
- Amazon marketplace APIs

---

## 4. Future Open Pomelli / Brand hook

Products can later hang under `Brand → many Products` without schema rewrites that invent Brand IDs today. `brandName` is plain metadata only. Campaign / Brand DNA / platform format packs remain Brand-domain concerns.
