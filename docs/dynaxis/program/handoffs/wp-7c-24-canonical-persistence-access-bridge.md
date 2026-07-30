# WP-7C-24 Canonical Persistence Access Bridge — Handoff

## Scope

- Work Package: WP-7C-24 Canonical Persistence Access Bridge (Projects and
  Assets only)
- Logical WP branch: `phase-7c/canonical-persistence-access-bridge`
- Isolated implementation branch (this environment): `claude/route-migration-projects-assets-i5kutb`
- Base SHA: `3bf25175e34154faed8ebca9adad4d250a10044a` (verified `origin/main`)
- Migration owner: **true** — owns migration `0014`
- Status: in_progress (implementation complete; awaiting review/integration)
- Blocks: WP-7C-14 only

## Why This Work Package Exists

WP-7C-14 (Route Migration: Projects and Assets) was blocked on a persistence
dependency: `dynaxis_projects.owner_ref` and `dynaxis_assets.owner_ref` were
`NOT NULL`, the only `owner_ref` scheme is the legacy `ak_sha256:<api-key-hash>`
derived from an `x-api-key`, and the store exposed only `owner_ref`-keyed
methods. A canonical Better Auth principal has no legacy `owner_ref`, so it
could neither create nor discover canonical Projects/Assets. WP-7C-24 is the
minimum correction: canonical persistence for Projects and Assets, nothing
else. Persistence gaps in other domains remain out of scope and untouched.

## Migration 0014 — exact operations

```sql
ALTER TABLE "dynaxis_projects" ALTER COLUMN "owner_ref" DROP NOT NULL;
ALTER TABLE "dynaxis_assets" ALTER COLUMN "owner_ref" DROP NOT NULL;
```

No other table changes. No data rewrite, no backfill, no `owner_ref` deletion,
no new `organization_id` columns. Registered in `drizzle/meta/_journal.json` as
idx 14; the runtime runner (`scripts/dynaxis-db-migrate.js`) applies sorted
`.sql` files transactionally.

## Canonical Store API (PostgreSQL store + memory-store parity)

### Projects

- `createCanonicalProject({ organizationId, userId, name, description?, status?, isDefault?, metadata? })`
  — atomic Project (`owner_ref NULL`, canonical `organization_id`) plus explicit
  creator Project membership (role `owner`) in one transaction. The membership
  row lives in the existing `dynaxis_project_members` table, so the database's
  Project membership invariants apply unchanged — including the composite FK
  requiring the creator to be a Better Auth member of the same Workspace. A
  failed membership insert rolls the Project back (no durable orphan Project).
  The memory store simulates the transaction by staging the Project and removing
  it if membership creation throws. Only the creator receives this membership;
  Workspace owner/admin never implies Project owner.
- `getCanonicalProject(projectId)` — Project row by id.
- `updateCanonicalProject({ projectId, organizationId }, patch)` —
  Workspace-scoped update; cross-Workspace attempts return `null`.
- `listCanonicalProjectsForUser({ organizationId, userId, includeArchived })` —
  only Projects the user is an explicit `dynaxis_project_members` member of.
  Workspace membership alone reveals no Projects.
- `getCanonicalDefaultProjectForUser({ organizationId, userId })` — the Default
  Project the user is an explicit member of; a shared Workspace never exposes
  another member's Default Project. Legacy `getDefaultProject(ownerRef)` is
  unchanged.

### Assets

- `createCanonicalAsset({ projectId, ... })` — `owner_ref NULL`, Project-owned;
  preserves generation/job linkage, type/source, provider/model metadata,
  and provenance fields unchanged.
- `getCanonicalAsset(assetId)` — Asset row by id.
- `listCanonicalAssetsForProject({ projectId, generationId?, limit? })` —
  Project-scoped listing with optional generation filter.
- `findAssetOwnership(assetId)` — trusted ownership lookup returning exactly
  `{ type: 'asset', id, projectId, organizationId }` or `null` when the Asset
  does not exist. `organizationId` is resolved
  Asset -> Project -> `dynaxis_projects.organization_id`, never caller input;
  `null` under an unprojected legacy Project. Satisfies the WP-7C-13
  `resourceRepository.findResource` contract.

### Legacy isolation

Legacy `owner_ref` methods are unchanged. Canonical rows (`owner_ref NULL`)
never match legacy `eq(owner_ref, <key>)` queries; membership-scoped canonical
listing never surfaces legacy rows (their `organization_id` is null). No
canonical method falls back to `owner_ref`, and no `owner_ref` parameter is
overloaded with a Workspace or user id.

## Acceptance (a Better Auth user with no x-api-key can):

1. create a canonical Project — YES (`createCanonicalProject`).
2. receive explicit Project owner membership transactionally — YES (same call,
   atomic with rollback).
3. list only Projects they explicitly belong to — YES
   (`listCanonicalProjectsForUser`).
4. resolve their Default Project safely — YES
   (`getCanonicalDefaultProjectForUser`).
5. create/read/list canonical Assets through Project ownership — YES
   (`createCanonicalAsset` / `getCanonicalAsset` /
   `listCanonicalAssetsForProject` + `findAssetOwnership`).

Nothing beyond those five is part of this correction.

## Tests

`tests/dynaxis-canonical-persistence-bridge.test.mjs` — 13 tests, all passing:

- Projects: canonical create with `owner_ref NULL`; legacy create unchanged;
  creator owner membership; membership-failure rollback (no orphan Project);
  membership-scoped listing (non-member and foreign-Workspace exclusion);
  per-user Default Project; Workspace-scoped update rejecting cross-Workspace
  writes; canonical/legacy partition isolation.
- Assets: canonical create with `owner_ref NULL`; legacy create unchanged;
  Project-scoped listing; trusted ownership lookup deriving Workspace through
  the Project (missing Asset -> null, legacy Project -> null organization);
  cross-Project ownership cannot be spoofed by caller input.

## Validation Evidence

- Bridge tests: 13 passed / 13.
- `npm run test:dynaxis`: 379 passed / 383. The 4 failures are pre-existing
  environmental failures, previously confirmed identical on the clean base SHA:
  `tests/dynaxis-auth-context-route-context.test.mjs` (`Cannot find module
  'next/server'` under the bare `node --test` loader) and 3 PostgreSQL tests
  that fail before assertions because the sandbox cannot create a System V
  shared-memory segment (`initdb`/`shmget`), the same blocker recorded in the
  WP-7C-12/13 handoffs.
- Top-level `npm test` JS suite: 17 passed / 17.
- `npm run program:status`: valid, no INVALID; WP-7C-24 `in_progress`,
  WP-7C-14 `blocked`; WP-7C-15/16/17 remain `ready` and untouched.
- `git diff --check`: clean; changed paths only within WP-7C-24 allowed paths.
- `lib/dynaxis/identity/project-membership.js` was NOT modified — the atomic
  creator membership uses the existing `dynaxis_project_members` table and its
  database invariants inside the store transaction.

## Environmental Blockers

- Live migration `0014` execution requires PostgreSQL; the sandbox cannot start
  it (`initdb` shmget). SQL and journal validated statically.
- Push attempts return HTTP 403 from the session git relay (policy denial;
  reads succeed).
- The environment's SSH commit-signing key is empty, so commits are unsigned
  though authored/committed as `Claude <noreply@anthropic.com>`.
- `npm run build:packages` / `npm run build` cannot run here: the workspace
  packages are git submodules whose clone is denied by the session egress
  policy. WP-7C-24 changes no `packages/**` or build inputs.

## Confirmation

- Projects and Assets only; no persistence change for any other domain.
- No fake canonical `owner_ref`; no `owner_ref` overloaded with ids.
- No `organization_id` added to `dynaxis_assets` or anywhere else.
- Legacy `owner_ref` paths preserved and isolated.
- No route files modified; WP-7C-14 not started; WP-7C-15/16/17 untouched.
- No authorization/identity kernel change; no package or lockfile change.
- Programme graph: WP-7C-24 blocks only WP-7C-14; WP-7C-15/16/17 dependencies
  and statuses unchanged.
