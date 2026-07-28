# AuthContext Route Helper Migration

WP-7C-13 adds the route boundary that later route-migration packages must use
when replacing the legacy `requireOwnerFromRequest()` bridge. This guide is a
contract for WP-7C-14 through WP-7C-17; it does not migrate route files.

## Helper Surface

Import helpers from `@/lib/dynaxis/api` in route files that already use shared
Dynaxis API helpers, or from `@/lib/dynaxis/auth/route-context` in lower-level
server-only modules.

- `loadRouteAuthContext(request, opts)` loads canonical AuthContext from a
  Next.js `Request` without requiring authentication.
- `requireRouteAuthContext(request, opts)` requires an authenticated subject.
- `requireRouteWorkspace(request, opts)` requires an authenticated Workspace
  member.
- `requireRouteProject(request, opts)` resolves and requires Project context.
- `requireRoutePermission(request, opts)` evaluates a canonical permission and
  returns the route context plus the authorization decision.
- `withAuthContextRoute(request, handler, opts)` wraps a route handler and maps
  AuthContext authentication and authorization failures to standard JSON
  responses.
- `jsonRouteAuthError(err)` and `jsonError(err)` map AuthContext route failures
  to the same public JSON shape.

## Standard Error Shape

AuthContext route helpers return only bounded public auth errors:

```json
{ "error": "Authentication required", "code": "DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED" }
```

The public code varies by outcome:

- `DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED` for missing authenticated subject.
- `DYNAXIS_ROUTE_AUTH_FORBIDDEN` for forbidden authenticated requests.
- `DYNAXIS_ROUTE_AUTH_NOT_FOUND` for not-found-shaped authorization denials,
  including cross-scope resource mismatches.
- `DYNAXIS_ROUTE_AUTH_INVALID_REQUEST` for invalid helper usage such as missing
  permission names.
- `DYNAXIS_ROUTE_AUTH_WORKSPACE_REQUIRED` for active Workspace membership
  requirements outside a permission decision.

Responses intentionally omit authorization decision internals, raw request
headers, Project membership rows, and resource scope mismatch details.

## Legacy Compatibility

Legacy `x-api-key` compatibility is disabled by default. Routes must opt in
explicitly:

```js
return withAuthContextRoute(request, handler, {
  legacyCompatibility: true,
});
```

When enabled, the helper derives the server-side `ownerRef` through the
canonical WP-7C-12 compatibility path. The raw API key is never attached to
AuthContext and is not serialized by the helper. Route contexts expose bounded
audit metadata:

```js
ctx.legacyCompatibility
// {
//   enabled: true,
//   presented: true,
//   used: true,
//   source: 'x-api-key',
//   mode: 'legacy-owner-ref-route',
//   ownerRef: 'ak_sha256:...'
// }
```

Use this only for route families that still need owner-ref partition
compatibility while they are migrated. Do not pass `apiKey` to domain services
from new AuthContext routes.

## Migration Pattern

Replace legacy route shells like this:

```js
return withPlatformAuth(request, async ({ ownerRef }) => {
  const rows = await service.list({ ownerRef });
  return jsonOk({ rows });
});
```

with a canonical AuthContext route boundary:

```js
return withAuthContextRoute(
  request,
  async ({ authContext }) => {
    const rows = await service.list({
      workspaceId: authContext.workspace.organizationId,
      principal: authContext.principal,
    });
    return jsonOk({ rows });
  },
  {
    permission: 'workspace.read',
  }
);
```

For Project-owned children, resolve Project context at the route boundary and
authorize through resource inheritance. The resource metadata used for
authorization must come from a trusted repository/service lookup, not from
echoing route parameters:

```js
return withAuthContextRoute(
  request,
  async ({ authContext }) => {
    const asset = await service.getAuthorized({
      projectId: authContext.project.projectId,
      assetId,
      principal: authContext.principal,
    });
    return jsonOk({ asset });
  },
  {
    permission: 'asset.read',
    projectId,
    resourceId: assetId,
    resourceType: 'asset',
    resourceRepository: assetOwnershipRepository,
  }
);
```

`assetOwnershipRepository.findResource({ type, id })` should return only
bounded ownership metadata such as `{ type: 'asset', id, projectId,
organizationId }`, or `null` when the resource is missing. Do not authorize an
asset by passing `{ projectId }` copied from the route; that cannot detect
cross-Project or cross-Workspace resources.

## Route-Family Notes

WP-7C-14 should use these helpers for Projects and Assets first. Asset routes
that still read historical owner-ref partitions may enable
`legacyCompatibility: true` temporarily, and must keep the route-level audit
metadata visible in tests or handoff notes.

WP-7C-15 should use `requireRoutePermission()` or `withAuthContextRoute()` for
Generations, Jobs, and lifecycle routes. Job and generation children must
authorize through their canonical Project relationship rather than flattening
Workspace ids onto every child.

WP-7C-16 should use Workspace-root permissions for reusable Character, Product,
Brand, and Campaign roots, and resource-inheritance permissions only for
Project-scoped uses.

WP-7C-17 should use the same route boundary for Design APIs and Mini App
execution. Provider credentials, model accounts, and worker adapters must not
be accepted as identity subjects.

## Out Of Scope

This guide does not authorize route migration, client session migration,
TanStack Query work, schema changes, Provider Connections, Developer Platform
API credentials, a second Project entity, or a Better Auth replacement.
