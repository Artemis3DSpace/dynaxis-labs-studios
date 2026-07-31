# WP-7D-05 MuAPI Credential Migration and Provider Resolver — Handoff

## Scope

- Work Package: WP-7D-05 MuAPI Credential Migration and Provider Resolver
- Branch: `phase-7d/muapi-credential-migration-provider-resolver`
- Base SHA: `86620a278e8bf58aceffa0928cf096a380458c0b`
- Migration owner: false — **no new schema, no new migration**
- Status: review (not done)

## MuAPI / Provider Resolver Files

**Added** (both on the ProviderConnection side of the boundary):

- `lib/dynaxis/provider-connections/resolver.js` — the Provider Resolver:
  `assertProviderConnectionCapablePrincipal()`, `selectProviderConnection()`,
  `assertProviderMatches()`, `dispatchWithProviderConnection()`, and the
  MuAPI-pinned `withMuapiCredential()`.
- `lib/dynaxis/provider-connections/muapi-migration.js` —
  `importLegacyMuapiCredential()` and `hasMigratedMuapiConnection()`.

**Unchanged, deliberately:** `lib/dynaxis/providers/muapi.js`. The adapter
already takes `apiKey` as a call argument on `submit()` / `retrieve()`, which is
exactly the WP-7D-01 handoff shape — it never decrypts, never resolves keys, and
never reads connection rows. Nothing in `lib/dynaxis/providers/**` was modified.

### Why the resolver lives outside `lib/dynaxis/providers/**`

WP-7D-04 asserts that no file in `lib/dynaxis/providers/` may reference
`materializeProviderCredential` or import `secrets/envelope.js` /
`secrets/keys.js`. Putting the resolver there would have broken that invariant
and forced an edit to an integrated security test. Instead the resolver sits on
the connection side and *feeds* adapters, so `providers/**` stays pure adapter
code and the WP-7D-04 invariant holds unmodified. WP-7D-05 adds its own
stricter version of that assertion (`providers/**` must not import
`provider-connections/` at all).

## ProviderConnection Runtime Integration Points

Selection order, per the WP-7D-05 deliverable:

1. explicit `connectionId` when the caller supplies one;
2. otherwise the owner's default connection for that provider
   (`defaultForWorkspace` / `defaultForUser`, `status = 'active'`, not revoked
   or tombstoned).

Selection uses only the existing WP-7D-04 repository interface
(`findConnectionById`, `listConnectionsForWorkspace`,
`listConnectionsForUser`), so no repository or schema change was needed and any
WP-7D-04-compatible repository works unchanged.

Dispatch flows entirely through the integrated boundary:

```
AuthContext -> assertProviderConnectionCapablePrincipal
            -> selectProviderConnection (providerId pinned)
            -> useProviderCredential  (WP-7D-04)
                 -> service.resolveForUse  (authz + lifecycle + capability/model)
                 -> openSecret             (AAD rebuilt from persisted row)
                 -> audit
            -> dispatch({ apiKey, ... })   -> provider adapter
```

`provider_connection.use` is checked inside `resolveForUse`; the resolver never
re-implements authorization. `assertProviderMatches` is applied both at
selection and again on the materialized credential, so a MuAPI dispatch can
never be served by another provider's credential.

## Legacy x-api-key Compatibility Behaviour

The legacy conflation being unwound: today an `x-api-key` value is *both* the
caller's identity (hashed into `owner_ref` by `ownerRefFromApiKey`) **and** the
MuAPI credential handed to the adapter. WP-7D-05 separates those.

- `assertProviderConnectionCapablePrincipal()` rejects `legacy` principals
  **before any connection is loaded** — an explicit, auditable early gate on top
  of the WP-7D-04 policy, which would deny them anyway.
- A legacy principal cannot select, dispatch, import, or even query migration
  state. Tested across all four entry points.
- Importing a MuAPI key creates **no** `owner_ref` and derives **no** identity
  from key material; ownership is a Better Auth user or Workspace.
- Existing legacy routes were **not** rewired. `lib/dynaxis/api.js`,
  `lib/dynaxis/ownership.js`, and `app/api/**` are outside WP-7D-05's Allowed
  Paths, so the legacy path continues to work exactly as before and route
  migration belongs to a package that owns those files. This is additive: the
  canonical path now exists alongside the legacy one.

## Migration Path Without Raw-Key Persistence

`importLegacyMuapiCredential()` accepts the raw key as an argument (unavoidable
— you must hold the key to migrate it), hands it straight to
`service.create()`, and drops it. The service seals it into an AES-256-GCM
envelope. The raw value is never written to a metadata column, logged, audited,
cached, or returned; tests assert it appears in neither the connection row, the
envelope row, the audit log, nor the returned projection.

`hasMigratedMuapiConnection()` reports migration state **without accepting key
material at all** — matching is by provider and ownership. Comparing key
material would require a reversible or comparable stored form, which the secret
boundary forbids. A test asserts the signature mentions no credential parameter
and that the module never fingerprint-compares.

## Fail-Closed Behaviour

Covered and tested: no matching connection, unknown `connectionId`,
unauthorized actor, wrong owner, wrong workspace, legacy principal, service /
api-key / provider-credential principals, `providerId` mismatch (explicit and
via default selection), disabled, pending verification, revoked, deleted,
rotation required, secret missing, secret corrupted, expired, key unavailable,
capability denied, model denied, and Project-scoped use without a sufficient
Project role.

Two tests additionally assert that on key failure and on envelope corruption the
**dispatch callback never runs**, so no code path can observe plaintext when
materialization fails.

## Audit Behaviour

Reuses the WP-7D-04 auditor unchanged — no new audit surface. Denied resolver
attempts, use-attempted / succeeded / failed, and secretStatus transitions are
recorded by the boundary. Tests assert the migrated MuAPI key never appears in
audit output.

## Tests Added

`tests/dynaxis-provider-connections-resolver.test.mjs` — 17 tests covering
migration with no raw persistence, canonical resolution and plaintext scoping,
explicit-over-default selection, legacy principal denial across four entry
points, non-human principal denial, missing connection, `providerId` mismatch,
unauthorized actors, eight lifecycle fail-closed states, key-unavailable and
corrupt-envelope with callback-never-runs assertions, capability/model
enforcement, Workspace-role-does-not-grant-Project-execution, a real
`MuAPIProvider` driven end-to-end with a fake `fetch`, migration detection
without key comparison, adapter-purity, resolver-uses-boundary, and
no-OAuth/UI/schema/migration.

## Confirmations

- **No OAuth implementation.** Asserted by test.
- **No UI implementation.** No `packages/studio/src/**`, no
  `app/api/dynaxis/provider-connections/**`. Asserted by test.
- **No provider-specific migration**, and **no schema or migration** — the
  `drizzle/` tree is untouched; tests assert the last migration is still `0015`
  and the count is still 16.
- **No raw secret leakage** — asserted against the connection row, envelope row,
  audit log, and returned projection.
- **No provider adapter secret-boundary bypass** — `providers/**` imports
  neither secret internals nor `provider-connections/`.
- **WP-7D-06 remains backlog.** **WP-7D-07 remains backlog.**

## WP-7D-04 Follow-Ups: Status

Per instruction, these were **not** silently solved:

1. **Phase 7D permission vocabulary** — still local; untouched.
2. **Durable audit sink** — still future work; the in-memory sink is reused as-is.
3. **Service-principal allowlist** — still undefined and still fail-closed. The
   resolver explicitly refuses `service` principals, so WP-7E job/worker
   dispatch remains blocked until an allowlist is defined. This is now a hard
   dependency for WP-7E-06.
4. **Credential plaintext trimming** — flagged as needing confirmation before
   provider-specific migration. **Confirmed consistent, no change made.** The
   pre-existing legacy path already trims MuAPI keys in two places
   (`ownerRefFromApiKey` does `String(apiKey).trim()`, and the client stores a
   trimmed value), so WP-7D-04's `normalize()` trim matches established MuAPI
   behaviour rather than introducing new mutation. A migrated key therefore
   produces the same bytes the legacy path would have sent. Recorded here so
   WP-7D-07 can ratify it rather than re-derive it.

## Validation Evidence

- `git status --short` — only WP-7D-05 files; clean after commit
- `git diff --check` — clean
- `npm run program:status` — valid; WP-7D-05 under `review`
- `npm run test:dynaxis` — **493 passed / 494** (baseline 476/477; +17 new).
  Known baseline failure unchanged:
  `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`.

## Follow-Ups for Review

1. Route migration: `app/api/**` and `lib/dynaxis/api.js` still use the legacy
   `x-api-key` conflation. A package owning those paths should switch canonical
   sessions onto `withMuapiCredential()`.
2. Default-flag mutation in `importLegacyMuapiCredential` writes
   `defaultForWorkspace` / `defaultForUser` via the repository, because the
   service exposes no patch for routing flags. If WP-7D-06 adds default-routing
   management, that should move behind a service method.
