/**
 * ProviderConnection permission vocabulary (WP-7D-04).
 *
 * WP-7D-01 defines these as "a Phase 7D domain vocabulary". They live in this
 * Phase 7D registry rather than `lib/dynaxis/auth/permissions.js` because that
 * canonical registry is outside WP-7D-04's Allowed Paths, and appending to it
 * changes `DYNAXIS_PERMISSION_NAMES.length` and the workspace-policy matrix
 * count asserted by `tests/dynaxis-authorization-policy.test.mjs` — also
 * outside this package's Allowed Paths. The definition shape, decision shape,
 * and reason codes deliberately mirror the canonical evaluator so a later
 * package that owns both files can merge this vocabulary without redesign.
 *
 * Provider credentials are never identity: these permissions authorize
 * operations *on* a connection, never authentication *by* one.
 */

const HUMAN_ONLY = Object.freeze(['human']);

/** Workspace roles that may act on a workspace-owned connection. */
const WORKSPACE_ADMIN = Object.freeze(['owner', 'admin']);
const WORKSPACE_READ = Object.freeze(['owner', 'admin', 'member', 'viewer']);
const WORKSPACE_USE = Object.freeze(['owner', 'admin', 'member']);

/** Project roles that may dispatch with a connection in a Project scope. */
const PROJECT_EXECUTE = Object.freeze(['owner', 'admin', 'editor']);

function definePermission(name, definition) {
  return Object.freeze({
    name,
    domain: 'provider_connection',
    allowedPrincipalTypes: HUMAN_ONLY,
    /** Workspace roles accepted when the connection is workspace-owned. */
    workspaceRoles: Object.freeze([]),
    /** Project roles accepted when the operation is Project-scoped. */
    projectRoles: Object.freeze([]),
    /** Whether the owning user may perform this on their own connection. */
    ownerUserAllowed: true,
    /** Whether the operation may be Project-scoped at all. */
    projectScoped: false,
    ...definition,
  });
}

export const PROVIDER_CONNECTION_PERMISSIONS = Object.freeze({
  'provider_connection.create': definePermission('provider_connection.create', {
    workspaceRoles: WORKSPACE_ADMIN,
  }),
  'provider_connection.read': definePermission('provider_connection.read', {
    workspaceRoles: WORKSPACE_READ,
  }),
  'provider_connection.use': definePermission('provider_connection.use', {
    workspaceRoles: WORKSPACE_USE,
    projectRoles: PROJECT_EXECUTE,
    projectScoped: true,
  }),
  'provider_connection.rotate': definePermission('provider_connection.rotate', {
    workspaceRoles: WORKSPACE_ADMIN,
  }),
  'provider_connection.revoke': definePermission('provider_connection.revoke', {
    workspaceRoles: WORKSPACE_ADMIN,
  }),
  'provider_connection.delete': definePermission('provider_connection.delete', {
    workspaceRoles: WORKSPACE_ADMIN,
  }),
  'provider_connection.audit.read': definePermission('provider_connection.audit.read', {
    workspaceRoles: WORKSPACE_ADMIN,
  }),
});

export const PROVIDER_CONNECTION_PERMISSION_NAMES = Object.freeze(
  Object.keys(PROVIDER_CONNECTION_PERMISSIONS).sort()
);

export function isProviderConnectionPermission(permission) {
  return Object.prototype.hasOwnProperty.call(PROVIDER_CONNECTION_PERMISSIONS, permission);
}

export function getProviderConnectionPermission(permission) {
  return PROVIDER_CONNECTION_PERMISSIONS[permission] || null;
}
