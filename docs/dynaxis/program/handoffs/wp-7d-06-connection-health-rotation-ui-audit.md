# WP-7D-06 Connection Health Rotation UI and Audit — Handoff

## Scope

- Work Package: WP-7D-06 Connection Health Rotation UI and Audit
- Branch: `phase-7d/connection-health-rotation-ui-audit`
- Base SHA: `15938784ad842a10822adff030f20bd4fe2ab725`
- Migration owner: false — **no new schema, no new migration**
- Status: review (not done)

## Health Files Added

- `lib/dynaxis/provider-connections/health.js` — the safe health vocabulary
  (`healthy`, `pending`, `disabled`, `rotation_required`, `rotation_due_soon`,
  `revoked`, `deleted`, `secret_missing`, `secret_corrupted`,
  `secret_unavailable`, `expired`, `provider_error`, `unknown`),
  `classifyConnectionHealth()`, `toPublicConnectionHealth()`,
  `listConnectionHealth()`, `getConnectionHealth()`, `isUsableHealth()`.

Classification reads server-only fields (`secretStatus`, `rotationInProgress`)
but never emits them — the browser receives one derived label. Precedence
mirrors `ProviderConnectionService.assertUsable`, so the label a user sees
matches the error dispatch would actually raise.

## Audit Visibility Files Added

- `lib/dynaxis/provider-connections/audit-view.js` —
  `readProviderConnectionAudit()` (requires `provider_connection.audit.read`
  against the persisted row) and `toPublicAuditEvent()`.

Events are **re-scrubbed on read** through an independent allowlist, so a sink
populated by any other means still cannot surface forbidden material. Durable
audit persistence is deliberately not implemented: it would require schema,
which WP-7D-06 does not own.

## Route / API Files Added

Under `app/api/dynaxis/provider-connections/`:

- `route.js` — `GET` health list; exports `assertCanonicalPrincipal`
- `[connectionId]/route.js` — `GET` detail, `DELETE` soft-delete
- `[connectionId]/rotate/route.js` — `POST` rotation
- `[connectionId]/revoke/route.js` — `POST` revoke
- `[connectionId]/audit/route.js` — `GET` scrubbed audit

Plus `lib/dynaxis/provider-connections/index.js`, a server-only entry point so
route code never imports the secret runtime. It deliberately re-exports **no**
secret primitive.

### Why routes do not use `requireRoutePermission`

The `provider_connection.*` vocabulary lives in the Phase 7D registry (see the
WP-7D-04 handoff), so the canonical evaluator returns `UNKNOWN_PERMISSION` for
it. Routes therefore delegate authorization to the ProviderConnection service
and health/audit helpers, which call `authorizeProviderConnection` directly.
This is fail-closed either way — the canonical evaluator would deny, not allow
— and it disappears once the vocabulary merge follow-up lands.

Scope is taken from the authenticated context, never the query string, so a
client cannot point the listing at another Workspace.

## UI Files Added

Under `packages/studio/src/provider-connections/`:

- `api.js` — session-scoped fetchers plus `assertNoForbiddenFields()`
- `health-display.js` — pure label/tone/action mapping over the server's label
- `ConnectionHealthPanel.jsx` — list, health badges, rotation form, revoke and
  delete with confirmation
- `index.js`

The rotation input lives in component state for the duration of the submit and
is cleared immediately afterwards (including on failure). It is never written
to localStorage, sessionStorage, a query cache, or a URL.

`assertNoForbiddenFields` **throws** rather than silently stripping: quietly
dropping a leaked field would hide a server-side regression.

## Rotation / Revoke / Delete Boundaries

All three delegate to the integrated WP-7D-04 service, which owns the
permission check, the secret lifecycle, and the audit record:

| Action | Permission | Service method |
|---|---|---|
| Rotate | `provider_connection.rotate` | `service.rotate` |
| Revoke | `provider_connection.revoke` | `service.revoke` |
| Delete | `provider_connection.delete` | `service.remove` |

The raw replacement credential is accepted only at the route boundary and
handed straight to `service.rotate` for sealing. The rotation route rejects any
client-supplied `secretRef`, `keyRef`, `secretVersion`, `encryptedPayload`,
`authTag`, `iv`, `aad*`, `secretStatus`, or `credentialFingerprint` — those are
server-owned, and accepting them would let a caller steer the secret boundary.

No OAuth refresh flow, and no provider-side credential validation: the new
credential is **not** sent to MuAPI to "check" it.

## Redaction Model

Three independent allowlist layers, each sufficient on its own:

1. `toPublicProviderConnection` (WP-7D-04) — the base allowlist;
2. `toPublicConnectionHealth` — composes that projection and adds only derived
   labels, so a future column cannot leak through the health surface either;
3. `assertNoForbiddenFields` (client) — fails closed if a response ever carries
   a forbidden field.

Audit adds a fourth on the read path (`toPublicAuditEvent` + re-scrub).

## Tests Added

`tests/dynaxis-provider-connections-console.test.mjs` — 15 tests: health
classification across all 13 states in severity order; **adversarial redaction**
(a row carrying every forbidden field projects to exactly eight safe keys);
list/detail redaction; foreign-owner denial (empty list, not an existence
hint); legacy `x-api-key` denied across health/rotate/revoke/delete/audit;
rotation sealing with no plaintext in response, row, envelope, or audit;
permission separation (member denied rotate/revoke/delete, viewer allowed
read); revoked/deleted surfacing and unusability; **adversarial audit** (a
hostile record written straight into the sink is re-scrubbed on read);
audit projection dropping nested structures; client fail-closed assertions;
UI display helpers; route-source assertions; no-OAuth/schema/migration; and
`providers/**` purity.

### Three prior-WP tests updated

`tests/dynaxis-provider-connections-{schema,services,resolver}.test.mjs` (all
inside this package's Allowed Paths) each asserted that
`app/api/dynaxis/provider-connections` and
`packages/studio/src/provider-connections` **do not exist** — correct for
WP-7D-03/04/05, obsolete the moment WP-7D-06 added its chartered surfaces.

Each absence assertion was replaced with the stronger durable invariant: the
surfaces exist but must not import `secrets/keys.js` / `secrets/envelope.js` or
call `openSecret` / `sealSecret` / `resolveKey`. **No security assertion was
weakened** — the raw-secret-column checks, AAD binding tests, permission tests,
and adapter-purity checks are all untouched.

## Confirmations

- **No OAuth implementation.** Asserted by test across health, audit-view,
  index, and every route.
- **No provider adapter changes.** `lib/dynaxis/providers/**` — 0 files changed;
  purity re-asserted.
- **No schema or migration.** `drizzle/` untouched; tests assert the last
  migration is still `0015` and the count is still 16.
- **No `secretRef` / `keyRef` / envelope metadata / IV / authTag / AAD /
  ciphertext / plaintext browser exposure.** Proven by adversarial injection at
  both the row and audit-event level.
- **WP-7D-07 remains backlog.**

## Carried-Forward Follow-Ups (not solved here)

- WP-7D-07 should add broader resolver-selection regression tests (user-owned
  foreign explicit id, foreign `ownerUserId` default spoof, null workspace
  context plus foreign `organizationId`).
- WP-7D-07 should explicitly document AuthContext as the Phase 7C/7D trust root.
- Service-principal allowlist remains undefined and fail-closed; WP-7E job and
  worker dispatch must not use ProviderConnections until it exists.
- Canonical `provider_connection.*` permission merge remains future work — and
  is now also what would let routes use `requireRoutePermission` directly.
- Durable audit sink remains future work; this package explicitly does not own
  it because it would require schema.
- KMS wiring remains future work.
- Route migration for the legacy `x-api-key` paths and the repository
  default-flag write remain future work.

## Validation Evidence

- `git status --short` — only WP-7D-06 files; clean after commit
- `git diff --check` — clean
- `npm run program:status` — valid; WP-7D-06 under `review`
- `npm run test:dynaxis` — **509 passed / 510** (baseline 494/495; +15 new).
  Known baseline failure unchanged:
  `tests/dynaxis-auth-context-route-context.test.mjs`,
  `ERR_MODULE_NOT_FOUND` for `next/server`.

## Note for Review

Route files import `next/server` transitively via `@/lib/dynaxis/api`, which is
not resolvable in this test environment (the same cause as the known baseline
failure). Route behaviour is therefore covered by source-level assertions
rather than by importing the handlers; the logic those handlers delegate to
(health, audit-view, service) is fully covered by direct tests.
