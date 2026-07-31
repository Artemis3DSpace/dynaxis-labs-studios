/**
 * ProviderConnection authorization (WP-7D-04).
 *
 * Authority flow (WP-7D-01):
 *   Better Auth user/session -> AuthContext -> Dynaxis authorization policy
 *   -> ProviderConnection permission -> server-only service -> secret unwrap
 *   -> provider adapter
 *
 * Invariants enforced here:
 *   - only `human` principals may act; legacy `x-api-key` compatibility grants
 *     no ProviderConnection authority, and service principals are deferred
 *     (fail-closed) until a later package allowlists them;
 *   - a user-owned connection is a same-user credential: the caller must BE
 *     `ownerUserId`. Workspace role never substitutes;
 *   - a workspace-owned connection requires the caller's active Workspace to
 *     match `ownerWorkspaceId` plus a sufficient Workspace role;
 *   - Workspace role alone never grants Project execution: Project-scoped use
 *     additionally requires a sufficient Project role;
 *   - provider account metadata is never consulted for authorization.
 */

import 'server-only';
import {
  ALLOW,
  EXPLICIT_DENY,
  INSUFFICIENT_PROJECT_ROLE,
  INSUFFICIENT_WORKSPACE_ROLE,
  NOT_PROJECT_MEMBER,
  NOT_WORKSPACE_MEMBER,
  NO_PRINCIPAL,
  NO_PROJECT,
  NO_WORKSPACE,
  UNKNOWN_PERMISSION,
  UNSUPPORTED_PRINCIPAL,
} from '../auth/policy.js';
import { getProviderConnectionPermission } from './permissions.js';

/** Domain-specific reason on top of the canonical vocabulary. */
export const OWNER_MISMATCH = 'OWNER_MISMATCH';

const SUPPORTED_HUMAN_AUTH_METHODS = Object.freeze(['session', 'oauth-token']);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function textOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function decision(input, reason, extras = {}) {
  return {
    allowed: reason === ALLOW,
    reason,
    permission: input?.permission,
    ...(input?.connection?.id ? { connectionId: input.connection.id } : {}),
    ...(textOrNull(input?.workspace?.organizationId)
      ? { workspaceId: input.workspace.organizationId }
      : {}),
    ...(textOrNull(input?.project?.projectId) ? { projectId: input.project.projectId } : {}),
    ...extras,
  };
}

function isSupportedPrincipal(principal) {
  if (!principal || typeof principal !== 'object') {
    return false;
  }
  if (principal.type !== 'human') {
    return false;
  }
  if (!SUPPORTED_HUMAN_AUTH_METHODS.includes(principal.authMethod)) {
    return false;
  }
  return hasText(principal.principalId) && hasText(principal.userId);
}

function parseRoles(role) {
  return String(role || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function roleSatisfies(role, allowedRoles) {
  if (!allowedRoles?.length) {
    return false;
  }
  const roles = parseRoles(role);
  return allowedRoles.some((allowed) => roles.includes(allowed));
}

/**
 * Authorizes a ProviderConnection operation.
 *
 * @param {object} input
 * @param {string} input.permission          provider_connection.* name
 * @param {object} input.principal           AuthContext principal
 * @param {object} [input.workspace]         AuthContext workspace projection
 * @param {object} [input.project]           AuthContext project projection
 * @param {object} input.connection          persisted connection ownership row
 * @param {boolean} [input.projectScoped]    true when dispatch targets a Project
 */
export function authorizeProviderConnection(input = {}) {
  const definition = getProviderConnectionPermission(input.permission);
  if (!definition) {
    return decision(input, UNKNOWN_PERMISSION);
  }

  if (!input.principal) {
    return decision(input, NO_PRINCIPAL);
  }

  // Legacy x-api-key principals and service principals are denied outright:
  // provider credentials must never bootstrap ProviderConnection authority.
  if (!isSupportedPrincipal(input.principal)) {
    return decision(input, UNSUPPORTED_PRINCIPAL);
  }

  const connection = input.connection || null;
  if (!connection) {
    return decision(input, EXPLICIT_DENY, { matchedPolicy: 'provider-connection' });
  }

  const ownerType = textOrNull(connection.ownerType);
  const callerUserId = textOrNull(input.principal.userId);

  if (ownerType === 'user') {
    // Same-user credential. Workspace role is irrelevant and never sufficient.
    if (!definition.ownerUserAllowed) {
      return decision(input, EXPLICIT_DENY, { matchedPolicy: 'provider-connection' });
    }
    if (textOrNull(connection.ownerUserId) !== callerUserId) {
      return decision(input, OWNER_MISMATCH, { matchedPolicy: 'provider-connection' });
    }
  } else if (ownerType === 'workspace') {
    const workspaceId = textOrNull(input.workspace?.organizationId);
    if (!workspaceId) {
      return decision(input, NO_WORKSPACE);
    }
    if (input.workspace?.isMember !== true) {
      return decision(input, NOT_WORKSPACE_MEMBER);
    }
    if (textOrNull(connection.ownerWorkspaceId) !== workspaceId) {
      return decision(input, OWNER_MISMATCH, { matchedPolicy: 'provider-connection' });
    }
    if (!roleSatisfies(input.workspace?.role, definition.workspaceRoles)) {
      return decision(input, INSUFFICIENT_WORKSPACE_ROLE, { matchedPolicy: 'workspace' });
    }
  } else {
    return decision(input, EXPLICIT_DENY, { matchedPolicy: 'provider-connection' });
  }

  // Project-scoped dispatch needs its own Project authority in addition to the
  // Workspace/owner check above. Workspace role never implies Project execution.
  if (input.projectScoped === true) {
    if (!definition.projectScoped) {
      return decision(input, EXPLICIT_DENY, { matchedPolicy: 'provider-connection' });
    }
    const projectId = textOrNull(input.project?.projectId);
    if (!projectId) {
      return decision(input, NO_PROJECT);
    }
    if (input.project?.isMember !== true) {
      return decision(input, NOT_PROJECT_MEMBER);
    }
    if (!roleSatisfies(input.project?.role, definition.projectRoles)) {
      return decision(input, INSUFFICIENT_PROJECT_ROLE, { matchedPolicy: 'project' });
    }
  }

  return decision(input, ALLOW, { matchedPolicy: 'provider-connection' });
}

export function checkProviderConnectionPermission(context, permission, input = {}) {
  return authorizeProviderConnection({
    permission,
    principal: context?.principal || null,
    workspace: input.workspace || context?.workspace || null,
    project: input.project || context?.project || null,
    connection: input.connection || null,
    projectScoped: input.projectScoped === true,
  });
}
