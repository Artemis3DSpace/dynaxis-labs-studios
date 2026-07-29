# WP-7C-14 Route Migration: Projects and Assets — Handoff

## Scope

- Work Package: WP-7C-14 Route Migration: Projects and Assets
- Branch: `phase-7c/route-migration-projects-assets`
- Base SHA: `4f496ff0fcd19a8505b17fce0a9843834143b25e`
- Migration owner: **false**
- Depends on: WP-7C-13 (integrated), WP-7C-24 (integrated)

## Implementation Summary

- Migrated Projects routes (`list/create/get/update/archive`) to `withAuthContextRoute()` with
  `legacyCompatibility: true`. Better Auth principals use canonical persistence and
  `requireRoutePermission()`; legacy `x-api-key` principals continue through the route-helper
  compatibility path with `ownerRef` partition services unchanged.
- Migrated Assets routes (`list/create/get/content`) to AuthContext with project/resource
  authorization via `assetOwnershipRepository.findResource()` for canonical reads.
- Added canonical service helpers in `lib/dynaxis/services/projects.js` and
  `lib/dynaxis/services/assets.js` consuming WP-7C-24 store operations.
- Preserved Default Project behavior for both legacy (`ensureDefaultProject`) and canonical
  (`ensureCanonicalDefaultProject`) paths.

## Route Authorization Matrix

| Route | Canonical permission | Legacy path |
| --- | --- | --- |
| `GET /projects` | `workspace.read` | `ownerRef` list |
| `POST /projects` | `project.create` | `ownerRef` create |
| `GET /projects/[id]` | `project.read` | `ownerRef` get |
| `PATCH /projects/[id]` | `project.update` / `project.archive` | `ownerRef` update/archive |
| `GET /assets` | `project.read` (requires `projectId`) | `ownerRef` list |
| `POST /assets` | `asset.create` | `ownerRef` register |
| `GET /assets/[id]` | `asset.read` + ownership repository | `ownerRef` get |
| `GET /assets/[id]/content` | `asset.read` + ownership repository | `ownerRef` get + blob delivery |

Cross-workspace and missing-resource access returns standard 403/404 via AuthContext route
helpers without leaking ownership metadata.

## Validation Evidence

- `tests/dynaxis-platform-services.test.mjs`: 16 passed / 16 (includes canonical service,
  owner/admin/editor/viewer authorization, cross-workspace denial, legacy audit metadata).
- `git diff --check`: clean.

## Migration Status

No migration added (migration owner: false). Consumes WP-7C-24 canonical persistence only.
