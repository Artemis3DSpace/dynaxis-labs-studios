# WP-7C-16 Route Migration: Characters Products Brands Campaigns Handoff

## Scope

- Work Package: WP-7C-16 Route Migration Characters Products Brands Campaigns
- Branch: `phase-7c/route-migration-characters-products-brands-campaigns`
- Worktree: `dynaxis-labs-studios-phase-7c-route-migration-characters-products-brands-campaigns`
- Base SHA: `4f496ff0fcd19a8505b17fce0a9843834143b25e`
- Migration owner: false
- Migration status: routes migrated; no schema/migrations added

## Implementation Summary

- Migrated all Character, Product, Brand, and Campaign API routes from `withPlatformAuth` to `withAuthContextRoute` with `legacyCompatibility: true`.
- Services (`characters.js`, `products.js`, `brands.js`, `campaigns.js`) accept canonical route context via `resolveRouteServiceContext()` while preserving string `ownerRef` compatibility for existing tests and legacy callers.
- Added ownership repositories and memory registries for route resource inheritance (`characterOwnershipRepository`, `productOwnershipRepository`, `brandOwnershipRepository`, `campaignOwnershipRepository`).
- Project association routes (`*/[id]/projects`) enforce nested `requireRoutePermission` with `project_{domain}` resource inheritance.
- Campaign routes remain project-scoped where applicable (`campaign.create` / list filters pass `projectId`).
- Revision, asset-link, and cross-entity association behavior preserved.

## Legacy Compatibility

- All migrated routes set `legacyCompatibility: true` so existing `x-api-key` clients continue to work.
- `resolveRouteServiceContext()` resolves `ownerRef` from legacy subject, legacy compatibility audit metadata, or a single legacy owner-ref claim on the workspace organization.
- Canonical Better Auth sessions without a resolvable legacy partition receive `PERSISTENCE_PARTITION_UNAVAILABLE` (503) from services — intentional until WP-7C-24 extends canonical persistence beyond projects/assets.

## Blockers / Follow-ups

- **Canonical persistence gap**: characters/products/brands/campaigns store methods still require `owner_ref NOT NULL`. Non-legacy canonical users without exactly one legacy claim cannot write until a future persistence bridge WP extends partition resolution.
- **Out of scope (unchanged)**: projects, assets, generations, jobs, design route domains remain on `withPlatformAuth`.

## Validation Evidence

```bash
NODE_ENV=test DYNAXIS_PLATFORM_DRIVER=memory DYNAXIS_ALLOW_MEMORY_STORE=1 \
  node --import ./tests/setup/allow-server-only.mjs --test \
  tests/dynaxis-characters.test.mjs \
  tests/dynaxis-products.test.mjs \
  tests/dynaxis-brands.test.mjs \
  tests/dynaxis-campaigns.test.mjs
```

- Result: **44 passed / 44 total**
- `git diff --check`: passed

## Files Changed (32)

- Routes: `app/api/dynaxis/{characters,products,brands,campaigns}/**` (28 route files)
- Services: `lib/dynaxis/services/{characters,products,brands,campaigns}.js`
- Handoff: this document
