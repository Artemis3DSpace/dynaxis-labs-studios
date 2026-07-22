# Dynaxis Product System

**Canonical architecture** for persistent Products in Dynaxis Labs Studios.  
**Phase introduction:** `PHASE_6A_PRODUCT_SYSTEM.md`

---

## Distinctions (non-negotiable)

| Entity | What it is | What it is not |
|--------|------------|----------------|
| **Product** | Owner-scoped creative/commercial identity (name, visual description, reference Assets, revisions) | An Asset, a Generation, a Project, or a Brand |
| **Brand** | Owner-scoped creative identity + Brand DNA; Products may link via `dynaxis_brand_products` | Not a Product; optional `brandName` string on Product is legacy metadata only until linked |
| **Asset** | Stored media (URL + metadata) | Product identity |
| **Generation** | One creative run with provenance | The Product itself |
| **Project** | Workspace that may *link* many Products | Product owner (owner is `owner_ref`) |
| **Mini App** | Product Studio consumes the Product domain | Does not own Product storage |

---

## Domain model

```text
Owner (owner_ref)
  └─ Product Library
       └─ Product
            ├─ Product Revisions (immutable snapshots)
            ├─ Product ↔ Assets (roles + order + primary)
            ├─ Product ↔ Projects (M:N links)
            └─ Product ↔ Brands (optional M:N via dynaxis_brand_products)
```

Continuity strategy: **reference-based** (`PRODUCT_CONTINUITY_STRATEGY`).

Optional Brand association is additive (Phase 6C). See `BRAND_SYSTEM.md`. Product-only generation remains valid.

### Identity vs scene styling

- **Product identity** — shape, packaging, labels, canonical references, visual description. Mutates only via explicit Product edits / reference promote → new revision.
- **Generation styling** — scene preset, custom prompt, aspect ratio, lighting/location. Lives on Generation metadata. Does **not** rewrite Product.

---

## Schema (PostgreSQL + Drizzle)

- `dynaxis_products`
- `dynaxis_product_revisions`
- `dynaxis_product_assets`
- `dynaxis_project_products`
- Generation columns: `product_id`, `product_revision_id`

Migration: `drizzle/0002_dynaxis_products.sql`

### Asset roles (justified)

`product_reference` · `packaging_reference` · `label_reference` · `logo_reference` · `detail_reference` · `transparent_product_reference` · `generated_product_scene`

---

## Services & APIs

- Service: `lib/dynaxis/services/products.js`
- HTTP: `/api/dynaxis/products` (+ `[id]`, `assets`, `projects`, `revisions`)
- Client: `createPlatformClient` Product methods
- Permissions (Mini App): `products:read` · `products:write`

Ownership: every Product operation is gated by `owner_ref`. A Product ID alone never authorizes access.

---

## Product Consumer

`lib/dynaxis/products/consumer.js`

- `resolveProductContext(client, productId, options)`
- `ProductVisualContext` (name, visual description, selected refs, revision id)
- `publishProductGenerationContext` / window bridge for studio lifecycle

Shared UI: `ProductPicker` · `ProductReferencePicker` under `packages/studio/src/components/product/`.

### Consumers

| Consumer | Role |
|----------|------|
| **Product Studio** Mini App | Create/edit Products, product-scene photography |
| **Marketing Studio** | Optional Product selection + references for marketing video ads (Phase 6B) |
| **Campaign Studio** | Optional Product revision pins on Brand-led Campaigns (Phase 6D) |

---

## Product Studio Mini App

- ID: `dynaxis.product-studio`
- Package: `packages/mini-apps/product-studio/`
- Model: `nano-banana-2-edit` (max **14** reference images — verified against Dynaxis `models.js`)
- Scene presets: seven upstream photography templates (MIT-adapted, Amazon branding removed)
- Lifecycle: Mini App Runtime → Generation → Job → MuAPI adapter → Assets
- Outputs: Dynaxis image Assets with role `generated_product_scene`
- Promote to `product_reference` is **explicit only**

---

## Future (out of scope for this document’s implementation)

- Amazon SP-API / marketplace publishing
- Skills / Agents / Supercomputer callers (headless capability already invokable)

Brand DNA: `BRAND_SYSTEM.md`. Campaigns: `CAMPAIGN_SYSTEM.md`.
