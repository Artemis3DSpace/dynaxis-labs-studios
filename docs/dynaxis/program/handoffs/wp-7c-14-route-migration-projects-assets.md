# WP-7C-14 Route Migration: Projects and Assets — Handoff

## Scope

- Work Package: WP-7C-14 Route Migration: Projects and Assets
- Branch: `phase-7c/route-migration-projects-assets`
- Base SHA: `4f496ff0fcd19a8505b17fce0a9843834143b25e` (post WP-7C-24)
- Status: review
- Migration owner: false (no schema/migration changes)

## What Changed

Projects and Assets API routes now use WP-7C-13 AuthContext route helpers and
WP-7C-24 canonical persistence (`owner_ref NULL` + membership-scoped access).

Route layer branches explicitly:

1. **Canonical** Better Auth session (`legacyCompatibility.used === false`)
2. **Legacy** `x-api-key` only when `legacyCompatibility: true` and the helper
   derives an `ownerRef`

No invented `owner_ref` values. No Workspace/user ids passed as `owner_ref`.
No hidden fallbacks between the two flows.

## Route Behavior

### Projects

- `GET /api/dynaxis/projects` — workspace required; lists via
  `listCanonicalProjectsForUser`; `ensureDefault` uses
  `getCanonicalDefaultProjectForUser` /
  `createCanonicalProject({ isDefault: true })`
- `POST /api/dynaxis/projects` — `project.create`; creates via
  `createCanonicalProject` (creator owner membership atomic)
- `GET/PATCH /api/dynaxis/projects/[id]` — `project.read` /
  `project.update` / `project.archive`; Workspace owner/admin does not
  bypass Project membership policy

### Assets

- `GET/POST /api/dynaxis/assets` — requires `projectId` for canonical flow;
  authorize Project then list/create via `listCanonicalAssetsForProject` /
  `createCanonicalAsset`
- `GET /api/dynaxis/assets/[id]` (+ content) — trusted `findAssetOwnership`
  then `asset.read` resource inheritance; never trusts URL ids alone

## Legacy Compatibility

Enabled explicitly with `{ legacyCompatibility: true }` on these routes only.
Legacy path continues to use `createProject` / `listProjects` / `registerAsset`
/ `getAsset` with `ownerRef` from the helper audit metadata.

## Validation

- `npm run program:status` — WP-7C-14 `review`; WP-7C-15/16/17 remain `ready`
- `git diff --check` — clean
- `npm test` / `npm run test:dynaxis` — 394 pass / 1 fail
  - sole failure: pre-existing `tests/dynaxis-auth-context-route-context.test.mjs`
    (`ERR_MODULE_NOT_FOUND` for `next/server`)

## Confirmations

- No schema or drizzle migration changes
- WP-7C-15 / WP-7C-16 / WP-7C-17 untouched
- No Generations/Jobs/Characters/Products/Brands/Campaigns/Compositions/Design
  route migration
- Do not merge; await integration review
