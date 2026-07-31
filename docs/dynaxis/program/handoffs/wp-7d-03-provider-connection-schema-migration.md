# WP-7D-03 Provider Connection Schema and Migration — Handoff

## Scope

- Work Package: WP-7D-03 Provider Connection Schema and Migration
- Branch: `phase-7d/provider-connection-schema-migration`
- Base SHA: `67e12951d06765d6b20b946f4fc84becf4235a18`
- Migration owner: **true** (owns migration `0015`)
- Status: review (not done)

Schema and migration only. Every runtime secret behavior is deferred to
WP-7D-04.

## Schema and Migration Added

New schema modules, split along the WP-7D-02 separation principle so the
metadata partition and the ciphertext partition are different modules as well
as different tables:

- `lib/dynaxis/provider-connections/schema.js` — `dynaxisProviderConnections`
  plus the owner/credential/status/metadata-source vocabularies.
- `lib/dynaxis/secrets/schema.js` — `dynaxisProviderSecretEnvelopes` plus the
  AEAD algorithm and envelope status vocabularies.

Registered in `lib/dynaxis/db/client.js` (`DRIZZLE_SCHEMA`) following the
existing `DYNAXIS_IDENTITY_DRIZZLE_SCHEMA` pattern, and added to the
`drizzle.config.js` schema list.

Migration: `drizzle/0015_phase_7d_3_provider_connections.sql`, registered as
journal entry `idx 15`. Migrations in this repo are hand-written SQL applied in
filename order by `scripts/dynaxis-db-migrate.js` (there are no drizzle-kit
snapshots in `drizzle/meta/`), so `0015` was hand-written to match the schema
modules exactly and verified statement-by-statement against PostgreSQL.

## Tables Added

### `dynaxis_provider_connections` (metadata partition)

All 44 WP-7D-01 contract fields: identity/ownership (`id`, `provider_id`,
`owner_type`, `owner_user_id`, `owner_workspace_id`), audit actors
(`created_by_user_id`, `last_updated_by_user_id`, `revoked_by_user_id`),
credential metadata (`credential_kind`, `secret_ref`, `secret_version`,
`key_ref`, `credential_fingerprint`, `expires_at`, `last_rotated_at`,
`rotation_required_at`, `envelope_created_at`, `rotation_in_progress`,
`secret_status`), display metadata (`label`, `provider_display_name`,
`provider_account_id`, `provider_account_label`,
`provider_account_avatar_url`, `provider_region`, `metadata_verified_at`,
`metadata_source`), `status`, scope/capability (`requested_scopes`,
`granted_scopes`, `allowed_capabilities`, `allowed_provider_models`,
`default_for_workspace`, `default_for_user`), and audit/tombstone
(`created_at`, `updated_at`, `last_used_at`, `last_use_job_id`,
`last_use_generation_id`, `last_health_checked_at`, `last_health_status`,
`revoked_at`, `deleted_at`, `audit_correlation_id`).

### `dynaxis_provider_secret_envelopes` (ciphertext partition)

`id` (envelopeId), `connection_id`, `secret_version`, `key_ref`, `algorithm`,
`encrypted_payload`, `auth_tag`, `iv`, the AAD context columns
(`aad_owner_type`, `aad_owner_id`, `aad_provider_id`, `aad_credential_kind`,
`aad_secret_version`), `status`, `created_at`, `rotated_from_envelope_id`.

The AAD columns persist exactly the binding WP-7D-02 specifies
(`ownerType:ownerId:providerId:credentialKind:secretVersion`) so WP-7D-04 can
reconstruct and verify it at unwrap time. Nothing validates AAD here.

## Constraints Added

Connections (11 checks + 5 FKs):

- `owner_type_check` — `owner_type in ('user','workspace')`
- `owner_target_check` — **the core ownership invariant**: `user` requires
  `owner_user_id` and forbids `owner_workspace_id`; `workspace` is the mirror
- `default_scope_check` — `default_for_workspace` only on workspace-owned rows,
  `default_for_user` only on user-owned rows
- `credential_kind_check`, `status_check`, `secret_status_check`,
  `metadata_source_check` — closed vocabularies
- `secretless_check` — `no_secret_required` forbids `secret_ref`,
  `secret_version`, and `credential_fingerprint`
- `revoked_tombstone_check` / `deleted_tombstone_check` — revoked/deleted
  states must record their timestamp, preserving audit evidence
- `secret_version_check` — versions are >= 1
- FKs: `owner_user_id` and `owner_workspace_id` → `auth.user` /
  `auth.organization` `ON DELETE restrict`; the three audit actors → `auth.user`
  `ON DELETE set null` (audit actors are not owners)

Envelopes (6 checks + 1 FK):

- `algorithm_check` — AEAD only (`aes-256-gcm`, `chacha20-poly1305`)
- `aad_owner_type_check`, `aad_version_check` (AAD version must equal the
  envelope version), `secret_version_check`, `rotated_from_self_check`,
  `status_check`
- FK `connection_id` → `dynaxis_provider_connections.id` `ON DELETE cascade`,
  so a hard-deleted connection never leaves orphan ciphertext

## Indexes Added

Connections (13): owner user, owner workspace, provider, status, composite
`(owner_workspace_id, provider_id, status)` and `(owner_user_id, provider_id,
status)`, `secret_ref`, `secret_status`, `(rotation_in_progress,
rotation_required_at)`, `deleted_at`, `audit_correlation_id`, plus two partial
unique indexes for default selection:

```sql
("owner_workspace_id","provider_id") WHERE "default_for_workspace" = true AND "deleted_at" IS NULL
("owner_user_id","provider_id")      WHERE "default_for_user" = true AND "deleted_at" IS NULL
```

Default uniqueness is scoped **per owner per provider** and ignores tombstones,
so it cannot block future multi-provider or multi-capability routing.

Envelopes (6): unique `(connection_id, secret_version)`, plus `connection_id`,
`status`, `key_ref`, `rotated_from_envelope_id`, and `(aad_owner_type,
aad_owner_id)`.

## Tests Added

`tests/dynaxis-provider-connections-schema.test.mjs` — 13 tests: schema exports
through `DRIZZLE_SCHEMA`; full WP-7D-01 column coverage; owner columns bound to
Better Auth while provider account metadata carries no identity FK; ownerType
constraints in both schema and migration; closed vocabularies; tombstone
semantics; envelope shape; metadata/ciphertext separation; **no forbidden raw
secret columns**; migration creates each table once and is journal-registered;
schema/migration index parity; no crypto/unwrap/key runtime; no services,
routes, or UI.

## Forbidden Raw Secret Persistence Checks

No column in either table stores raw credential material. The check runs
against **real column names** rather than migration text, deliberately:
`credential_kind` legitimately enumerates values such as `'api_key'`,
`'oauth_client_secret'`, `'service_account_json'`, and `'webhook_secret'`
inside a CHECK constraint, and those enum values are vocabulary, not storage — a
naive text grep would produce false positives. Forbidden patterns cover
`api_key`, anything matching `token`, `client_secret`, `service_account`,
`webhook_secret`, `plaintext`, `decrypted`, `password`, `private_key`, and
`authorization_code`.

Bare `secret` is intentionally *not* forbidden: `secret_ref`, `secret_version`,
`secret_status`, and `aad_secret_version` are opaque references and metadata.

`encrypted_payload`, `auth_tag`, and `iv` are AEAD ciphertext components on the
envelope table only, and are asserted absent from the connections table.

## Live Database Verification

Beyond the static tests, the full migration chain `0000`–`0015` was applied to a
throwaway local PostgreSQL database and the constraints were exercised with real
inserts, then the database was dropped. Verified enforcing:

- user-owned and workspace-owned rows insert; `user` + workspace id, `user`
  without user id, `workspace` + user id, `workspace` without workspace id, and
  an invalid `owner_type` (`provider_account`) are all **rejected**
- `no_secret_required` carrying a `secret_ref` is rejected
- `revoked`/`deleted` without their timestamps are rejected
- `default_for_user` on a workspace-owned row is rejected
- second workspace default for the same provider is rejected; a default for a
  *different* provider is allowed; a tombstoned default does not block a new one
- duplicate `(connection_id, secret_version)`, AAD version mismatch, and a
  non-AEAD algorithm (`aes-256-cbc`) are all rejected
- deleting a connection cascades its envelopes to zero rows

## Runtime Secret Handling Deferred to WP-7D-04

This package adds **no** encryption, decryption, unwrap, AAD runtime
validation, fail-closed runtime behavior, key generation, KMS integration, or
local/test key runtime. `lib/dynaxis/provider-connections/` and
`lib/dynaxis/secrets/` each contain exactly one file — `schema.js` — and a test
asserts that, plus asserts neither file references `node:crypto`, cipher
construction, encrypt/decrypt/unwrap calls, key generation, KMS, or OAuth.

`key_ref` stores a *reference* to a key (for example
`kms://region/alias/version`), never key material.

## Provider Services, OAuth, and UI Not Implemented

No provider connection service, no `app/api/dynaxis/provider-connections/**`
routes, no OAuth flow, no provider adapter materialization, and no
`packages/studio/src/**` UI. Asserted by test.

## Deviations

Two files outside the Work Package's listed Allowed Paths were edited, both
strictly required to deliver a migration this package explicitly owns
(`migration_owner: true`):

1. `drizzle/0015_phase_7d_3_provider_connections.sql` + `drizzle/meta/_journal.json`
   — the migration itself. The Allowed Paths list omits `drizzle/**` while the
   front matter sets `migration_owner: true`; migration ownership is read as the
   controlling grant, matching the WP-7C-24 precedent (which owned `0014` under
   the same shape).
2. `lib/dynaxis/db/client.js` and `drizzle.config.js` — one import/spread each to
   register the new schema modules. Without this the tables are not part of
   `DRIZZLE_SCHEMA` and the required deliverable ("schema exports include
   ProviderConnection tables") cannot hold. No other logic in either file changed.

No canonical architecture was rewritten and no other domain was touched.

## Validation Evidence

- `git status --short`: only WP-7D-03 files; working tree clean after commit
- `git diff --check`: clean
- `npm run program:status`: valid; WP-7D-03 listed under `review`
- `npm run test:dynaxis`: 451 passed / 452 (13 new tests; known baseline failure
  unchanged: `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`)
- Migration `0000`–`0015` applied and constraint-tested on live PostgreSQL

## Out of Scope (unchanged)

- WP-7D-04 services, permissions, and all secret runtime
- WP-7D-05 MuAPI credential migration; WP-7E job/worker work
- No route handlers, no auth kernel change, no Studio client screens
- No App Factory, Marketplace, or Supercomputer work
