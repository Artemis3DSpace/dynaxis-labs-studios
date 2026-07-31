# WP-7D-04 Provider Connection Services and Permissions — Handoff

## Scope

- Work Package: WP-7D-04 Provider Connection Services and Permissions
- Branch: `phase-7d/provider-connection-services-permissions`
- Base SHA: `d186757591f9e7085328bf3b06107a1f2c486f40`
- Migration owner: false — **no new schema, no new migration**
- Status: review (not done)

## Service Files Added

`lib/dynaxis/provider-connections/`

- `errors.js` — the WP-7D-01 logical error contract
  (`PROVIDER_CONNECTION_NOT_FOUND`, `_FORBIDDEN`, `_OWNER_MISMATCH`,
  `_INACTIVE`, `_ROTATION_REQUIRED`, `_REVOKED`, `_DELETED`,
  `_SECRET_MISSING/_UNAVAILABLE/_CORRUPT/_EXPIRED`, `_CAPABILITY_DENIED`,
  `_MODEL_DENIED`, …).
- `permissions.js` — the seven `provider_connection.*` permissions.
- `policy.js` — `authorizeProviderConnection()`.
- `redaction.js` — browser/public projection.
- `audit.js` — runtime audit contract, scrubber, and pluggable sink.
- `repository.js` — Drizzle boundary over the integrated `0015` tables.
- `service.js` — `ProviderConnectionService`: create, get, list, update,
  rotate, revoke, remove (soft-delete/tombstone), `resolveForUse`,
  `markSecretStatus`.
- `materialization.js` — `materializeProviderCredential()` and the scoped
  `useProviderCredential()`.

## Permission Checks Added

`provider_connection.create` / `.read` / `.use` / `.rotate` / `.revoke` /
`.delete` / `.audit.read`.

Enforced rules:

- **Only `human` principals.** Legacy `x-api-key` compatibility grants no
  ProviderConnection authority, and service principals are fail-closed until a
  later package allowlists them (WP-7D-01 calls service use "explicit future").
- **User-owned connections are same-user credentials**: the caller must *be*
  `ownerUserId`. A Workspace owner cannot act on another user's connection.
- **Workspace-owned connections** require the caller's active Workspace to
  equal `ownerWorkspaceId` *and* a sufficient Workspace role
  (owner/admin for create/rotate/revoke/delete/audit; +member for use;
  +viewer for read).
- **Workspace role never implies Project execution.** Project-scoped use
  additionally requires Project membership with owner/admin/editor.
- Provider account metadata is never consulted for authorization.

### Deviation: where the permission vocabulary lives

The seven permissions are defined in `lib/dynaxis/provider-connections/permissions.js`,
**not** appended to the canonical `lib/dynaxis/auth/permissions.js`. Two reasons:

1. `lib/dynaxis/auth/**` is outside WP-7D-04's Allowed Paths.
2. Appending changes `DYNAXIS_PERMISSION_NAMES.length` (75) and the
   workspace-policy matrix count (46), both hard-asserted in
   `tests/dynaxis-authorization-policy.test.mjs` — also outside this package's
   Allowed Paths.

The definition shape, decision shape, and reason codes deliberately mirror the
canonical evaluator (reason constants are imported from
`lib/dynaxis/auth/policy.js`), so a package that owns both files can merge the
Phase 7D vocabulary into the canonical registry without redesign. **Recommended
follow-up for WP-7D-07 or a dedicated package.**

## Secret Encryption/Decryption Boundary

`lib/dynaxis/secrets/envelope.js`

- AES-256-GCM by default (`chacha20-poly1305` also accepted, matching the
  `0015` algorithm CHECK). 256-bit key, fresh 96-bit random IV per encryption.
- AAD is exactly the WP-7D-02 binding:
  `ownerType:ownerId:providerId:credentialKind:secretVersion`.
- `openSecret()` rebuilds the expected AAD **from the persisted connection
  row**, never from request input, compares it against the envelope's persisted
  `aad_*` columns in constant time, and then lets the AEAD tag verify the
  binding cryptographically.
- Cipher errors are swallowed and re-thrown as a generic corrupt-envelope
  error so failures cannot leak structure.
- `credentialFingerprint()` is a truncated SHA-256 — irreversible and
  non-authenticating, for operator recognition only.

## Key-Management Boundary

`lib/dynaxis/secrets/keys.js` — `keyRef`-driven, three providers:

| Provider | keyRef | Behavior |
|---|---|---|
| Production KMS | `kms://region/alias/version` | Interface only. **Fails closed** (`KEY_PROVIDER_UNCONFIGURED`) until a deployment injects an adapter. No cloud SDK bundled, matching the instruction not to wire a real KMS. |
| Local dev | `local://key-id` | Key material read **only from the environment** (`DYNAXIS_SECRET_LOCAL_KEY[_<ID>]`), so nothing is committed and nothing is read from a repo path. Fails closed when absent. Refused outright in production. |
| Test | `test://algorithm/key-id` | Deterministic from a fixed seed, hard-gated to `NODE_ENV=test`; throws `KEY_PROVIDER_FORBIDDEN_ENVIRONMENT` anywhere else, so it cannot be reached in production by accident. |

Keys shorter than 256 bits are rejected. `defaultKeyRef()` returns `null` in
production and in dev-without-a-key, so there is no implicit key anywhere.

## Unwrap / Materialization Boundary

`materializeProviderCredential()` is the only place plaintext exists at
runtime, and it follows the WP-7D-01 ordering: authorize → load connection →
ownership → lifecycle state → capability/model constraints → load active
envelope → rebuild AAD from persisted context → unwrap → audit.

`useProviderCredential(context, options, dispatch)` scopes plaintext to a
single callback and nulls the reference in `finally`, so credentials are not
handed out as long-lived values.

Provider adapters never decrypt, never touch key management, and never import
`secrets/envelope.js` or `secrets/keys.js` — asserted by test across
`lib/dynaxis/providers/**`.

## Fail-Closed Behavior

Covered and tested: missing connection, unauthorized actor, wrong owner
(user and workspace), cross-workspace, missing Project context, non-member,
insufficient Project role, missing envelope, inactive envelope, corrupted
envelope, AAD mismatch, forged persisted AAD, wrong key, key unavailable,
unconfigured KMS, forbidden key environment, unsupported algorithm, expired
credential, disabled, pending verification, provider_error, revoked, deleted,
rotation required (status, deadline, and in-progress flag), secretStatus
corrupted/missing/rotation_required, capability denied, model denied.

Failures block dispatch, expose no plaintext, return sanitized structured
errors, update `secretStatus` where meaningful (`missing`, `corrupted`), and
write an audit event carrying the correlation id.

## Audit Behavior

`audit.js` defines the ProviderConnection audit contract with a pluggable sink
(default: bounded in-memory ring buffer — the repository has no general audit
infrastructure yet, and inventing durable audit persistence belongs to a
future package). Events: created, read, listed, updated, use attempted /
succeeded / failed, rotated, revoked, deleted, secret-status changed, denied.

`scrubAuditProperties()` is an **allowlist**: only known-safe scalar keys
survive, nested objects are dropped entirely, and forbidden keys (api keys,
tokens, client secrets, service-account JSON, webhook secrets, plaintext,
ciphertext, authTag, iv, aad, key material) are stripped. Tested with a payload
that attempts every one of these, including nesting.

## Tests Added

`tests/dynaxis-provider-connections-services.test.mjs` — 25 tests covering
create-encrypts/persists-references-only, AAD correctness across five wrong
contexts, **cryptographic** AAD binding (a forged persisted `aad_*` column that
defeats the string pre-check is still rejected by the AEAD tag), tampered
ciphertext, wrong key, the permission vocabulary, legacy/service/api-key/
provider-credential principals denied across all seven permissions, same-user
ownership, workspace matching and role sufficiency, Workspace-role-does-not-
grant-Project-execution, unauthorized read/use/rotate/revoke/delete, public
projection redaction, materialization, rotation + replay resistance, twelve
fail-closed lifecycle states, missing/corrupt envelope status transitions,
capability/model denial, key-provider environment gating, KMS fail-closed,
audit scrubbing, denied-attempt auditing, secretless credential kinds,
tombstone semantics, authorization-filtered listing, and no-OAuth/UI/adapter/
schema/migration assertions.

### Two WP-7D-03 tests updated

`tests/dynaxis-provider-connections-schema.test.mjs` (inside this package's
Allowed Paths) had two assertions that were correct for WP-7D-03 but became
obsolete the moment WP-7D-04 added its chartered runtime:

- "adds no encryption/…/key management runtime" asserted the two directories
  contained *only* `schema.js`;
- "adds no provider connection services, routes, or UI" asserted
  `service.js`, `secrets/envelope.js`, and `secrets/keys.js` did not exist.

Both were re-anchored to the durable invariant rather than a point-in-time file
inventory: the schema modules must stay declarative (same forbidden-runtime
patterns, unchanged in strength), no HTTP route or Studio UI surface may exist,
and the schema layer must not depend on the runtime layer. **No security
assertion was weakened**; the raw-secret-column checks are untouched.

## Confirmations

- **No OAuth implementation.** No authorization-code flow, redirect URI
  handling, or token exchange. Asserted by test.
- **No UI implementation.** No `packages/studio/src/**` and no
  `app/api/dynaxis/provider-connections/**`. Asserted by test.
- **No provider-specific adapter implementation.** `lib/dynaxis/providers/**`
  is untouched.
- **No provider-specific migration.**
- **No new schema or migration.** The `drizzle/` tree is unchanged; the test
  suite asserts the last migration is still `0015` and the count is still 16.
  No blocker requiring a schema change was encountered.
- **WP-7D-05 remains backlog.** Not started; MuAPI credential migration is out
  of scope.

## Validation Evidence

- `git status --short` — only WP-7D-04 files; clean after commit
- `git diff --check` — clean
- `npm run program:status` — valid; WP-7D-04 under `review`
- `npm run test:dynaxis` — **476 passed / 477** (baseline was 451/452; +25 new
  tests). Known baseline failure unchanged:
  `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`.

## Follow-Ups for Review

1. Merge the Phase 7D permission vocabulary into the canonical registry (needs
   a package owning both `lib/dynaxis/auth/permissions.js` and
   `tests/dynaxis-authorization-policy.test.mjs`).
2. Supply a durable audit sink when general audit infrastructure lands.
3. Wire a real KMS adapter per deployment; the boundary fails closed until then.
4. Service-principal `provider_connection.use` is deliberately denied; a later
   package must define the allowlist and Job/dispatch correlation.
