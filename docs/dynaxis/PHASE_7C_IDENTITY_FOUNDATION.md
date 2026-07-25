# Phase 7C.1 - Dynaxis Authentication Foundation

## Status

Phase 7C.1 establishes the authentication foundation for Dynaxis Labs Studios.
It does not complete Phase 7C.

Phase 7B is already merged into `main` at:

`cc86105d34564148b6783c3cac1d868b16ad0aca`

## Scope

This subphase adds Better Auth as the authentication engine behind a Dynaxis-owned
auth boundary.

Better Auth is infrastructure. It is not the Dynaxis domain model.

Dynaxis creative services continue to use their existing interfaces. Character,
Product, Brand, Campaign, Composition, Generation, Job, Asset, Provider, and
Project services do not receive Better Auth user objects in this subphase.

## Pinned Versions

Phase 7C.1 uses exact package versions:

- `better-auth` `1.6.23`
- `@better-auth/drizzle-adapter` `1.6.23`

The official pinned CLI package used for schema inspection was:

- `auth` `1.6.23`

The generated reference schema was written to:

`/tmp/dynaxis-better-auth-1.6.23-schema.ts`

That file is a temporary reference artifact and is not committed.

Phase 7C.2 generated a second pinned organization-plugin schema reference at:

`/tmp/dynaxis-better-auth-1.6.23-organization-schema.ts`

That file is also temporary and is not committed.

## Auth Boundary

Runtime code is isolated under:

`lib/dynaxis/auth/`

The Next.js route is:

`app/api/auth/[...all]/route.js`

Only `GET` and `POST` are exported for Phase 7C.1.

The route initializes the Better Auth runtime lazily so importing the route
during `next build` does not require a live PostgreSQL connection.

## PostgreSQL Boundary

Better Auth uses the same PostgreSQL database and the same shared Dynaxis
Drizzle/postgres.js pool as platform persistence.

It does not create a second database, second Drizzle runtime, or second
postgres.js pool.

Physical layout:

```text
PostgreSQL
|-- auth
|   |-- user
|   |-- session
|   |-- account
|   |-- verification
|   `-- rate_limit
`-- public
    |-- dynaxis_projects
    |-- dynaxis_generations
    |-- dynaxis_jobs
    |-- dynaxis_assets
    `-- existing Dynaxis domain tables
```

The Better Auth model is named `rateLimit`; the physical PostgreSQL table follows
the Better Auth 1.6.23 Drizzle generator and is named `auth.rate_limit`.

## Schema Notes

The Better Auth 1.6.23 CLI-generated Drizzle reference schema was reproduced in
JavaScript under:

`lib/dynaxis/auth/schema.js`

The deliberate difference is ID type:

- The CLI reference emits `text` ID columns.
- Dynaxis uses UUID columns and configures `advanced.database.generateId:
  "uuid"`.

This keeps future Dynaxis foreign keys able to reference `auth.user.id` with UUID
columns. It does not couple `owner_ref` to Better Auth IDs.

## Configuration

Better Auth is configured with:

- `appName: "Dynaxis Labs Studios"`
- `basePath: "/api/auth"`
- email/password enabled
- signup disabled
- auto sign-in disabled
- minimum password length 12
- maximum password length 128
- telemetry disabled
- implicit account linking disabled
- UUID database ID generation

Production requires:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

No real secret is committed.

## Sessions

Phase 7C.1 uses durable PostgreSQL-backed Better Auth sessions.

No Redis, secondary storage, or custom JWT session layer is added.

Cookie caching remains disabled so session revocation remains database-backed
and straightforward.

Later scalability work may introduce Better Auth `secondaryStorage` backed by
Redis behind the same Dynaxis auth boundary.

## Rate Limiting

Phase 7C.1 configures Better Auth rate limiting with database storage.

This avoids process-local rate limits in horizontally scaled deployments.

Later scalability work may move rate-limit state to Redis behind the same auth
boundary.

## Legacy Compatibility

Existing Dynaxis platform APIs remain on the legacy compatibility bridge:

```text
x-api-key -> SHA-256 -> owner_ref
```

The following are intentionally unchanged in Phase 7C.1:

- `lib/dynaxis/ownership.js`
- `requireOwnerFromRequest()`
- `withPlatformAuth()`
- `ownerRefFromApiKey()`
- the `x-api-key` header

Future Dynaxis API keys will use a separate header such as `x-dynaxis-api-key`.
That belongs to a later Phase 7C subphase and is not implemented here.

## Future Boundaries

Phase 7C.2 adds the Better Auth Organization plugin, personal workspace
provisioning, personal workspace protections, and active organization session
initialization. Public signup remains disabled.

Later Phase 7C subphases should add project membership, RBAC/ABAC, canonical
`AuthContext`, Dynaxis API keys, CLI login, and service-account/agent auth.

Phase 7D remains the provider-connections and encrypted-secrets phase. MuAPI,
Higgsfield, Fal, Replicate, and other provider credentials must not be stored as
Dynaxis user identity.

## Out Of Scope

Phase 7C.1 specifically does not implement:

- Better Auth Organization plugin
- Better Auth API Key plugin
- workspaces
- personal workspace provisioning
- organization membership
- project membership
- RBAC/ABAC
- canonical AuthContext route migration
- `x-dynaxis-api-key`
- device authorization
- CLI login
- agent authentication
- social OAuth
- SSO / SCIM
- 2FA / passkeys
- Provider Connections / Secrets
- MuAPI credential migration
- new generation providers
- queues, workers, or webhooks
- App Factory, Composer, Skills, or Supercomputer

See `PHASE_7C_WORKSPACE_FOUNDATION.md` for the Phase 7C.2 continuation.
