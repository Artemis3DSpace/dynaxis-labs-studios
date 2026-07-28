import 'server-only';
import { getPermissionDefinition } from './permissions.js';
import {
  ALLOW,
  EXPLICIT_DENY,
  INSUFFICIENT_PROJECT_ROLE,
  LEGACY_OWNERSHIP_UNRESOLVED,
  NO_PRINCIPAL,
  NO_PROJECT,
  NO_WORKSPACE,
  NOT_PROJECT_MEMBER,
  NOT_WORKSPACE_MEMBER,
  RESOURCE_SCOPE_MISMATCH,
  UNKNOWN_PERMISSION,
  UNSUPPORTED_PRINCIPAL,
} from './policy.js';
import {
  PROJECT_MEMBERSHIP_ERROR_CODES,
  projectMembershipService as defaultProjectMembershipService,
} from '../identity/project-membership.js';

export const DYNAXIS_PROJECT_POLICY_NAME = 'project';

export const DYNAXIS_PROJECT_ROLE_NAMES = Object.freeze(['owner', 'admin', 'editor', 'viewer']);

const ROLE_GRANTS = Object.freeze({
  all: Object.freeze(['owner', 'admin', 'editor', 'viewer']),
  write: Object.freeze(['owner', 'admin', 'editor']),
  administer: Object.freeze(['owner', 'admin']),
  owner: Object.freeze(['owner']),
});

const PROJECT_PERMISSION_ROLES = Object.freeze({
  'project.read': ROLE_GRANTS.all,
  'project.update': ROLE_GRANTS.write,
  'project.archive': ROLE_GRANTS.administer,
  'project.delete': ROLE_GRANTS.owner,
  'project.members.read': ROLE_GRANTS.write,
  'project.members.add': ROLE_GRANTS.administer,
  'project.members.update': ROLE_GRANTS.administer,
  'project.members.remove': ROLE_GRANTS.administer,
  'project.transfer': ROLE_GRANTS.owner,
  'settings.read': ROLE_GRANTS.all,
  'settings.manage': ROLE_GRANTS.administer,
});

const INHERITED_READ_WRITE_DELETE_DOMAINS = Object.freeze([
  'asset',
  'campaign',
  'composition',
]);

const INHERITED_LIFECYCLE_DOMAINS = Object.freeze(['generation', 'job']);
const PROJECT_SCOPED_REUSABLE_ROOT_DOMAINS = Object.freeze(['character', 'product', 'brand']);

const PROJECT_SCOPED_DESIGN_PERMISSIONS = Object.freeze({
  'design.read': ROLE_GRANTS.all,
  'design.create': ROLE_GRANTS.write,
  'design.update': ROLE_GRANTS.write,
  'design.delete': ROLE_GRANTS.administer,
  'design.publish': ROLE_GRANTS.write,
});

function resourceType(input = {}) {
  return String(input.resource?.type || input.resource?.resourceType || input.resourceType || '').trim();
}

function isProjectScopedReusableRootUse(permission, input = {}) {
  const [domain] = String(permission || '').split('.');
  if (!PROJECT_SCOPED_REUSABLE_ROOT_DOMAINS.includes(domain)) {
    return false;
  }
  const type = resourceType(input);
  return type === `project_${domain}` || type === `${domain}_use`;
}

function inheritedPermissionRoles(permission, input = {}) {
  const [domain, action] = String(permission || '').split('.');
  if (
    INHERITED_READ_WRITE_DELETE_DOMAINS.includes(domain) ||
    isProjectScopedReusableRootUse(permission, input)
  ) {
    if (action === 'read') return ROLE_GRANTS.all;
    if (action === 'create' || action === 'update') return ROLE_GRANTS.write;
    if (action === 'delete') return ROLE_GRANTS.administer;
  }
  if (INHERITED_LIFECYCLE_DOMAINS.includes(domain)) {
    if (action === 'read') return ROLE_GRANTS.all;
    if (action === 'create' || action === 'cancel' || action === 'retry') {
      return ROLE_GRANTS.write;
    }
  }
  return PROJECT_SCOPED_DESIGN_PERMISSIONS[permission] || null;
}

function requiredProjectRoles(permission, input = {}) {
  return PROJECT_PERMISSION_ROLES[permission] || inheritedPermissionRoles(permission, input);
}

function decision(input, reason, extras = {}) {
  return {
    allowed: reason === ALLOW,
    reason,
    permission: input?.permission,
    matchedPolicy: reason === ALLOW ? DYNAXIS_PROJECT_POLICY_NAME : extras.matchedPolicy,
    ...(input?.workspace?.organizationId ? { workspaceId: input.workspace.organizationId } : {}),
    ...(input?.project?.projectId ? { projectId: input.project.projectId } : {}),
    ...(extras.status ? { status: extras.status } : {}),
    ...(extras.failureKind ? { failureKind: extras.failureKind } : {}),
    ...(extras.requiredRoles ? { requiredRoles: extras.requiredRoles } : {}),
    ...(extras.role ? { role: extras.role } : {}),
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeProjectId(project) {
  return String(project?.projectId || project?.id || '').trim();
}

function normalizeWorkspaceId(workspace) {
  return String(workspace?.organizationId || '').trim();
}

function normalizeProjectWorkspaceId(project) {
  return String(project?.organizationId || '').trim();
}

function isHumanPrincipal(principal) {
  return (
    principal?.type === 'human' &&
    (principal.authMethod === 'session' || principal.authMethod === 'oauth-token') &&
    hasText(principal.principalId) &&
    hasText(principal.userId)
  );
}

function isLegacyPrincipal(principal) {
  return (
    principal?.type === 'legacy' &&
    principal.authMethod === 'legacy-muapi-key' &&
    hasText(principal.legacyOwnerRef)
  );
}

function membershipErrorDecision(input, err) {
  if (err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND) {
    return decision(input, NO_PROJECT, { status: 404, failureKind: 'not-found' });
  }
  if (err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED) {
    return decision(input, NO_PROJECT, { status: 404, failureKind: 'not-found' });
  }
  if (err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.WORKSPACE_MISMATCH) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
    });
  }
  return decision(input, EXPLICIT_DENY, {
    status: 403,
    failureKind: 'forbidden',
    matchedPolicy: 'explicit-deny',
  });
}

export function projectRoleGrantsPermission(role, permission) {
  const normalizedRole = String(role || '').trim();
  const roles = requiredProjectRoles(permission);
  return Boolean(roles && roles.includes(normalizedRole));
}

export function projectRoleGrantsScopedPermission(role, permission, input = {}) {
  const normalizedRole = String(role || '').trim();
  const roles = requiredProjectRoles(permission, input);
  return Boolean(roles && roles.includes(normalizedRole));
}

export function getProjectPermissionRoles(permission, input = {}) {
  return requiredProjectRoles(permission, input) || Object.freeze([]);
}

export function isProjectPolicyPermission(permission, input = {}) {
  return Boolean(requiredProjectRoles(permission, input));
}

export function normalizeProjectAccess(input = {}) {
  const membership = input.membership || null;
  const role = String(membership?.role || '').trim();
  const workspaceId = normalizeWorkspaceId(input.workspace);
  const projectWorkspaceId = String(membership?.organizationId || '').trim();
  const projectId = String(membership?.projectId || '').trim();
  const userId = String(membership?.userId || '').trim();
  const workspaceMatchesProject = Boolean(
    workspaceId && projectWorkspaceId && workspaceId === projectWorkspaceId
  );

  return {
    projectId: projectId || undefined,
    organizationId: projectWorkspaceId || undefined,
    userId: userId || undefined,
    role: DYNAXIS_PROJECT_ROLE_NAMES.includes(role) ? role : undefined,
    isMember: Boolean(membership),
    workspaceMatchesProject,
  };
}

export async function evaluateProjectPolicy(input = {}) {
  const definition = getPermissionDefinition(input.permission);
  if (!definition || !isProjectPolicyPermission(input.permission, input)) {
    return decision(input, definition ? EXPLICIT_DENY : UNKNOWN_PERMISSION, {
      status: definition ? 403 : 400,
      failureKind: definition ? 'forbidden' : 'invalid',
      matchedPolicy: definition ? DYNAXIS_PROJECT_POLICY_NAME : undefined,
    });
  }

  if (!input.principal) {
    return decision(input, NO_PRINCIPAL, { status: 401, failureKind: 'forbidden' });
  }

  if (isLegacyPrincipal(input.principal)) {
    return decision(input, LEGACY_OWNERSHIP_UNRESOLVED, {
      status: 403,
      failureKind: 'forbidden',
      matchedPolicy: 'legacy-compatibility',
    });
  }

  if (!isHumanPrincipal(input.principal)) {
    return decision(input, UNSUPPORTED_PRINCIPAL, { status: 403, failureKind: 'forbidden' });
  }

  const workspaceId = normalizeWorkspaceId(input.workspace);
  if (!workspaceId) {
    return decision(input, NO_WORKSPACE, { status: 403, failureKind: 'forbidden' });
  }
  if (input.workspace?.isMember !== true) {
    return decision(input, NOT_WORKSPACE_MEMBER, { status: 403, failureKind: 'forbidden' });
  }

  const projectId = normalizeProjectId(input.project);
  if (!projectId) {
    return decision(input, NO_PROJECT, { status: 404, failureKind: 'not-found' });
  }

  const suppliedProjectWorkspaceId = normalizeProjectWorkspaceId(input.project);
  if (suppliedProjectWorkspaceId && suppliedProjectWorkspaceId !== workspaceId) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
    });
  }

  const membershipService = input.projectMembershipService || defaultProjectMembershipService;
  let membership = null;
  try {
    membership = await membershipService.get({
      projectId,
      organizationId: workspaceId,
      userId: input.principal.userId,
    });
  } catch (err) {
    return membershipErrorDecision(input, err);
  }

  if (!membership) {
    return decision(input, NOT_PROJECT_MEMBER, { status: 403, failureKind: 'forbidden' });
  }

  const projectAccess = normalizeProjectAccess({
    workspace: input.workspace,
    project: input.project,
    membership,
  });

  if (
    !projectAccess.projectId ||
    projectAccess.projectId !== projectId ||
    !projectAccess.organizationId ||
    projectAccess.organizationId !== workspaceId
  ) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
    });
  }

  if (
    !projectAccess.userId ||
    projectAccess.userId !== input.principal.userId ||
    !projectAccess.role
  ) {
    return decision(input, NOT_PROJECT_MEMBER, { status: 403, failureKind: 'forbidden' });
  }

  const requiredRoles = requiredProjectRoles(input.permission, input);
  if (!projectRoleGrantsScopedPermission(projectAccess.role, input.permission, input)) {
    return decision(input, INSUFFICIENT_PROJECT_ROLE, {
      status: 403,
      failureKind: 'forbidden',
      matchedPolicy: DYNAXIS_PROJECT_POLICY_NAME,
      requiredRoles,
      role: projectAccess.role,
    });
  }

  return decision(input, ALLOW, {
    status: 200,
    requiredRoles,
    role: projectAccess.role,
  });
}

export const authorizeProjectPolicy = evaluateProjectPolicy;
