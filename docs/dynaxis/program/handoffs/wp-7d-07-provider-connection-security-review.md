# WP-7D-07 Provider Connection Security Review

## Scope

- Work Package: WP-7D-07 Provider Connection Security Review (review gate)
- Branch: `phase-7d/provider-connection-security-review`
- Base SHA: `b3a3e1bb5947078cc713174a536d750cf10ff445`
- Migration owner: false — **no schema, no migration**
- Status: review (not done)
- Blocks: WP-7E-04, WP-7G-02

Reviews the integrated WP-7D-03 (schema/migration `0015`), WP-7D-04 (services,
permissions, secret runtime), WP-7D-05 (resolver, MuAPI migration), and
WP-7D-06 (health, rotation, audit, routes, Studio).

## Files Reviewed

`lib/dynaxis/provider-connections/**` (schema, errors, permissions, policy,
redaction, audit, audit-view, health, repository, service, materialization,
resolver, muapi-migration, route-guard, index) ·
`lib/dynaxis/secrets/**` (schema, errors, keys, envelope) ·
`lib/dynaxis/providers/**` (adapter purity) ·
`app/api/dynaxis/provider-connections/**` (5 routes) ·
`packages/studio/src/provider-connections/**` (api, health-display, panel) ·
`drizzle/0015_phase_7d_3_provider_connections.sql` ·
`tests/dynaxis-provider-connections*.test.mjs`

## Checklist Results

| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Encryption / envelope correctness | **PASS** | AES-256-GCM, 96-bit random IV per seal, 16-byte tag; 200/200 unique IVs and ciphertexts for identical plaintext (WP-7D-03 review) |
| 2 | AAD binding | **PASS** | `ownerType:ownerId:providerId:credentialKind:secretVersion`; forged persisted `aad_*` still rejected by the AEAD tag |
| 3 | Key-management boundary | **PASS** | `keyRef`-driven; adapters cannot reach it; 256-bit enforced, longer keys truncated to 32 |
| 4 | KMS / local / test key safety | **PASS** | KMS fails closed unconfigured; local keys env-only and refused in production; test keys hard-gated to `NODE_ENV=test` |
| 5 | secretRef / keyRef handling | **PASS** | Never in any browser projection; selection gates on `provider_connection.read` |
| 6 | Ownership model | **PASS** | Owner columns are Better Auth FKs; user-owned is same-user; workspace-owned requires matching org |
| 7 | Permission enforcement | **PASS** | All 7 `provider_connection.*` enforced in service/health/audit helpers |
| 8 | Cross-workspace isolation | **PASS** | Foreign `organizationId` returns empty list; foreign id denied |
| 9 | Cross-user isolation | **PASS** | Workspace owner cannot act on another user's user-owned connection |
| 10 | Project execution isolation | **PASS** | Workspace role never grants Project execution; owner/admin/editor required |
| 11 | Legacy `x-api-key` | **PASS** | Rejected before connection load at guard, policy, and resolver |
| 12 | Service principals | **PASS (fail-closed)** | Denied at guard, policy, resolver; **no allowlist exists** — see residual risk R1 |
| 13 | Provider adapter purity | **PASS** | `providers/**` imports no ProviderConnection, secret, or auth module |
| 14 | MuAPI confused-deputy | **PASS** | `providerId` pinned and re-asserted; cross-tenant envelope repoint rejected by AAD |
| 15 | Rotation lifecycle | **PASS** | Versioned, sealed, audited; old version unusable; plaintext never returned/logged/audited |
| 16 | Revoke / delete lifecycle | **PASS** | Tombstoned with actor+timestamp, default routing cleared, dispatch fails closed |
| 17 | Health UI redaction | **PASS** | Allowlist projection; adversarial row yields 8 safe keys |
| 18 | Audit UI redaction | **PASS (fixed)** | `secretVersion`, `secretStatus`, `previousSecretStatus`, `algorithm` stripped |
| 19 | Logs / audit scrubbing | **PASS** | Console captured during rotate + use + failure paths: no credential literal |
| 20 | Browser / API / Studio redaction | **PASS** | 27-field forbidden scan across list, detail, audit, revoke, delete |
| 21 | Route authorization | **PASS** | Guard first, then service/helper permission checks; scope from AuthContext only |
| 22 | Error redaction | **PASS** | `jsonError` emits only `{error, code}`; `decision` never serialized |
| 23 | Job/worker boundary readiness | **NOT READY** | Service principals fail-closed; WP-7E-06 blocked — residual risk R1 |
| 24 | Schema / migration status | **PASS** | 16 migrations, last `0015`; nothing added |
| 25 | Residual risks / follow-ups | Documented below | 6 accepted, 5 fixed |

## Findings Fixed

**F1 — Detail endpoint enumeration oracle (low).** `getConnectionHealth`
returned `FORBIDDEN` for an existing foreign connection but `NOT_FOUND` for a
nonexistent id, letting a caller with a guessed id learn existence. Now both
return `NOT_FOUND`. Ownership enforcement is unchanged; only the distinction is
removed. The internal `service.get` keeps precise codes — it is not
browser-reachable and audit benefits from the exact reason.

**F2 — Route guard coupling (informational).** `assertCanonicalPrincipal` lived
in a route module that sibling routes imported across. Moved to
`lib/dynaxis/provider-connections/route-guard.js` and exported via the index.
Route files are now handlers only.

**F3 — `algorithm` in public audit (low).** Stripped from the public audit
projection. It is a fixed, publicly documented constant, but it is literally
envelope metadata and WP-7D-02 forbids returning envelope metadata to browsers.
Taking the stricter reading keeps the rule exception-free.

## Residual Risks Accepted

| ID | Risk | Severity | Rationale | Owner / Blocker |
|---|---|---|---|---|
| R1 | No service-principal allowlist; service principals fail-closed | **Medium** | Defining an allowlist safely needs the Job/dispatch correlation model, which does not exist yet. Fail-closed is the safe default. | **Blocks WP-7E-06.** WP-7E must define and test the allowlist before any worker dispatch uses ProviderConnections. |
| R2 | `provider_connection.*` vocabulary is Phase-7D-local, not in the canonical registry | **Low** | `lib/dynaxis/auth/permissions.js` and `tests/dynaxis-authorization-policy.test.mjs` are outside WP-7D-07 Allowed Paths, and the latter hard-asserts counts (75/46). The canonical evaluator returns `UNKNOWN_PERMISSION` → **deny**, so the split is fail-closed. | A package owning both files |
| R3 | Audit sink is in-memory; events do not survive restart | **Medium** | Durable audit needs schema; WP-7D-07 is `migration_owner: false`. Audit is structurally correct but not durable. | A future migration owner |
| R4 | Production KMS unwired | **Medium** | The adapter interface exists and fails closed; no deployment config contract exists to wire against. No silent fallback is possible. | Deployment / infra package |
| R5 | Route handlers not executed in tests | **Low** | `next/server` is unresolvable in this environment (same cause as the known baseline failure). Covered by source assertions + direct helper tests. | Blocked on test-env fix |
| R6 | Legacy `x-api-key` routes still un-migrated; repository default-flag write | **Low** | `lib/dynaxis/api.js` and `app/api/**` legacy paths are outside Allowed Paths. Legacy remains a compatibility principal with no ProviderConnection authority, so this is a cleanliness issue, not an authorization gap. | A package owning those paths |

## Status of All 11 Follow-Ups

| # | Follow-up | Status |
|---|---|---|
| 1 | Align detail `FORBIDDEN` vs `NOT_FOUND` | **FIXED** (F1) + tests |
| 2 | Move `assertCanonicalPrincipal` to shared helper | **FIXED** (F2) + test |
| 3 | Executed route-handler coverage | **BLOCKED** → R5 |
| 4 | Keep-or-strip `algorithm` | **FIXED — stripped** (F3) + seam test |
| 5 | Broader resolver-selection regressions | **FIXED** — tests #4/#5/#6 |
| 6 | Document AuthContext as trust root | **FIXED** — documented in `route-guard.js` and below |
| 7 | Service-principal allowlist | **ACCEPTED fail-closed** → R1, blocks WP-7E |
| 8 | Canonical permission merge | **ACCEPTED** → R2 |
| 9 | Durable audit sink | **ACCEPTED** → R3 |
| 10 | KMS wiring | **ACCEPTED** → R4 |
| 11 | Route migration + default-flag write | **ACCEPTED** → R6 |

## AuthContext Is the Phase 7C/7D Trust Root

Every ProviderConnection authorization decision — the route guard, the policy
evaluator, the service layer, health, and audit — derives entirely from the
AuthContext produced by Better Auth session resolution (WP-7C-12). Nothing
downstream re-derives identity from request input, query parameters, provider
account metadata, or credential material.

This was verified during the WP-7D-05 review: a *forged* AuthContext claiming
membership defeats these checks, but it defeats the integrated WP-7D-04
`service.get`/`resolveForUse` identically, and an *honest* non-member context
(`isMember: false`, what the real session resolver produces) is denied by both.
AuthContext construction is therefore the security-critical boundary, and it is
owned by Phase 7C, not Phase 7D.

## Evidence: Provider Credentials Are Not Identity

Test #18 plus supporting code assertions establish:

- **Provider account metadata is metadata only** — `policy.js` contains zero
  references to `providerAccount*`; an imported connection has
  `providerAccountId === null` while ownership points at Better Auth ids.
- **MuAPI credentials are not user identity** — importing produces no
  `owner_ref` and no `ak_sha256:` value on the row.
- **Imported credentials are not AuthContext principals** —
  `provider-credential`, `model-account`, and `worker-adapter` principal shapes
  are denied for all 7 permissions.
- **Legacy `x-api-key` is not a ProviderConnection credential** — it is refused
  at the guard, the policy, and the resolver, across all 8 operations.
- **ProviderConnection credentials grant no `provider_connection.*` authority.**
- **Provider adapters cannot authenticate users** — `providers/**` imports no
  `auth-context`, `getSession`, or `betterAuth`.
- **Better Auth remains the workspace/membership primitive** — `schema.js`
  ownership columns are FKs to `auth.user` / `auth.organization`.
- **Dynaxis Project remains canonical** — Project-scoped dispatch requires a
  Project role; Workspace role never substitutes (test #10).

## Evidence: Browser Redaction Holds

A 27-field forbidden-shape scan plus literal scanning for the raw secret,
`test://`, `kms://`, and `local://` was run across **list, detail, audit,
revoke, and delete** after a rotate and a `secretStatus` transition — all
clean, and all accepted by the Studio fail-closed guard. `algorithm` is now
included in the forbidden set.

## Evidence: Provider Adapters Remain Pure

`lib/dynaxis/providers/**` was not modified by any of WP-7D-04/05/06/07 and
imports no `provider-connections/`, no `secrets/`, no materialization helper,
and no auth module. Adapters receive `apiKey` as a call argument only.

## Evidence: Service Principals Remain Fail-Closed

Denied at three independent layers (route guard, policy `isSupportedPrincipal`,
resolver `assertProviderConnectionCapablePrincipal`) for all 7 permissions.
A test additionally asserts **no allowlist mechanism exists** in `policy.js`, so
WP-7E cannot assume one was quietly added.

**WP-7E dispatch must not use ProviderConnections until an explicit,
tested allowlist exists.** This is R1 and blocks WP-7E-06.

## Confirmations

- **No schema or migration** — 16 migrations, last `0015`; `drizzle/`
  untouched. No security defect required one.
- **No OAuth** — asserted across all new and reviewed modules.
- **No provider adapter implementation** — `providers/**` unchanged.
- **No raw secret leakage** — responses, rows, envelopes, audit, and captured
  console output all clean.
- **Studio fail-closed guard intact** — still lists `secretVersion` and
  `secretStatus`, still throws rather than stripping.

## Tests Added / Updated

**Added** `tests/dynaxis-provider-connections-security-review.test.mjs` — 18
negative tests mapping 1:1 to the required list, plus AAD-binding, route-guard
placement, and no-schema/OAuth/adapter assertions.

**Updated** `tests/dynaxis-provider-connections-console.test.mjs` — two
assertions changed from `FORBIDDEN` to `NOT_FOUND` to match the F1
anti-enumeration fix. This is the same denial with a less informative code; no
security assertion was weakened.

## Validation

- `git status --short` — only WP-7D-07 files; clean after commit
- `git diff --check` — clean
- `npm run program:status` — valid; WP-7D-07 under `review`
- `npm run test:dynaxis` — **529 passed / 530** (baseline 511/512; +18 new).
  Known baseline failure unchanged:
  `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`.

## Recommendation

Phase 7D ProviderConnection is **sound for integration** with the six residual
risks accepted. The one that gates other work is **R1**: WP-7E-06 must not
dispatch with ProviderConnections until a service-principal allowlist is
defined and tested. R3 (durable audit) and R4 (KMS) should be resolved before
production use of provider credentials at scale.
