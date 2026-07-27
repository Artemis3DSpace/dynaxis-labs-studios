import 'server-only';
import { getPermissionDefinition } from './permissions.js';
import { evaluateWorkspacePolicy } from './workspace-policy.js';

export const AUTHORIZATION_REASONS = Object.freeze({
  ALLOW: 'ALLOW',
  UNKNOWN_PERMISSION: 'UNKNOWN_PERMISSION',
  NO_PRINCIPAL: 'NO_PRINCIPAL',
  UNSUPPORTED_PRINCIPAL: 'UNSUPPORTED_PRINCIPAL',
  NO_WORKSPACE: 'NO_WORKSPACE',
  NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  INSUFFICIENT_WORKSPACE_ROLE: 'INSUFFICIENT_WORKSPACE_ROLE',
  NO_PROJECT: 'NO_PROJECT',
  NOT_PROJECT_MEMBER: 'NOT_PROJECT_MEMBER',
  INSUFFICIENT_PROJECT_ROLE: 'INSUFFICIENT_PROJECT_ROLE',
  RESOURCE_SCOPE_MISMATCH: 'RESOURCE_SCOPE_MISMATCH',
  LEGACY_OWNERSHIP_UNRESOLVED: 'LEGACY_OWNERSHIP_UNRESOLVED',
  OWNERSHIP_CONFLICT: 'OWNERSHIP_CONFLICT',
  EXPLICIT_DENY: 'EXPLICIT_DENY',
});

export const {
  ALLOW,
  UNKNOWN_PERMISSION,
  NO_PRINCIPAL,
  UNSUPPORTED_PRINCIPAL,
  NO_WORKSPACE,
  NOT_WORKSPACE_MEMBER,
  INSUFFICIENT_WORKSPACE_ROLE,
  NO_PROJECT,
  NOT_PROJECT_MEMBER,
  INSUFFICIENT_PROJECT_ROLE,
  RESOURCE_SCOPE_MISMATCH,
  LEGACY_OWNERSHIP_UNRESOLVED,
  OWNERSHIP_CONFLICT,
  EXPLICIT_DENY,
} = AUTHORIZATION_REASONS;

const SUPPORTED_AUTH_METHODS_BY_TYPE = Object.freeze({
  human: Object.freeze(['session', 'oauth-token']),
  'api-key': Object.freeze(['api-key']),
  service: Object.freeze(['internal']),
  legacy: Object.freeze(['legacy-muapi-key']),
});

const PERSONAL_WORKSPACE_DENIED_PERMISSIONS = Object.freeze([
  'workspace.members.invite',
  'workspace.members.update',
  'workspace.members.remove',
  'workspace.transfer',
]);

function decision(input, reason, extras = {}) {
  return {
    allowed: reason === ALLOW,
    reason,
    permission: input?.permission,
    ...(input?.workspace?.organizationId ? { workspaceId: input.workspace.organizationId } : {}),
    ...(input?.project?.projectId ? { projectId: input.project.projectId } : {}),
    ...(input?.resource?.type ? { resourceType: input.resource.type } : {}),
    ...(input?.resource?.id ? { resourceId: input.resource.id } : {}),
    ...extras,
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSupportedPrincipal(principal, definition) {
  if (!principal || typeof principal !== 'object') {
    return false;
  }

  const methods = SUPPORTED_AUTH_METHODS_BY_TYPE[principal.type];
  if (!methods || !methods.includes(principal.authMethod)) {
    return false;
  }
  if (!definition.allowedPrincipalTypes.includes(principal.type)) {
    return false;
  }

  if (principal.type === 'human') {
    return hasText(principal.principalId) && hasText(principal.userId);
  }
  if (principal.type === 'legacy') {
    return hasText(principal.legacyOwnerRef);
  }
  return hasText(principal.principalId);
}

function workspaceIsMissing(workspace) {
  return !workspace || !hasText(workspace.organizationId);
}

function workspaceMembershipIsMissing(workspace) {
  return workspace?.isMember !== true;
}

function projectIsMissing(project) {
  return !project || !hasText(project.projectId);
}

function projectMembershipIsMissing(project) {
  return project?.isMember !== true;
}

function workspaceScopeMismatch({ workspace, project, resource }) {
  const workspaceId = workspace?.organizationId;
  if (!workspaceId) {
    return false;
  }
  if (project?.organizationId && project.organizationId !== workspaceId) {
    return true;
  }
  if (resource?.organizationId && resource.organizationId !== workspaceId) {
    return true;
  }
  return false;
}

function projectScopeMismatch({ project, resource }) {
  if (!project?.projectId || !resource?.projectId) {
    return false;
  }
  return project.projectId !== resource.projectId;
}

function ownershipConflict(resource) {
  return resource?.ownershipConflict === true;
}

function isProjectScopedRequest(input, definition) {
  if (definition.scopeMode !== 'workspace-or-project') {
    return definition.scopeMode === 'project';
  }
  return hasText(input?.project?.projectId) || hasText(input?.resource?.projectId);
}

function effectivePolicyLayer(input, definition) {
  if (isProjectScopedRequest(input, definition)) {
    return definition.policyLayer === 'resource-inheritance' ? 'resource-inheritance' : 'project';
  }
  return definition.policyLayer;
}

function requiresProjectContext(input, definition) {
  return definition.requiredProject || isProjectScopedRequest(input, definition);
}

function legacyOwnershipUnresolved({ principal, resource }) {
  if (principal?.type !== 'legacy') {
    return false;
  }
  return Boolean(resource) && resource.legacyOwnershipResolved !== true;
}

export function authorizeDynaxis(input = {}) {
  const definition = getPermissionDefinition(input.permission);
  if (!definition) {
    return decision(input, UNKNOWN_PERMISSION);
  }

  if (!input.principal) {
    return decision(input, NO_PRINCIPAL);
  }

  if (!isSupportedPrincipal(input.principal, definition)) {
    return decision(input, UNSUPPORTED_PRINCIPAL);
  }

  if (definition.requiredWorkspace && workspaceIsMissing(input.workspace)) {
    return decision(input, NO_WORKSPACE);
  }

  if (definition.workspaceMembershipRequired && workspaceMembershipIsMissing(input.workspace)) {
    return decision(input, NOT_WORKSPACE_MEMBER);
  }

  const matchedPolicy = effectivePolicyLayer(input, definition);

  if (matchedPolicy === 'workspace') {
    const workspaceDecision = evaluateWorkspacePolicy({
      permission: input.permission,
      workspace: input.workspace,
    });
    if (!workspaceDecision.allowed) {
      return decision(input, INSUFFICIENT_WORKSPACE_ROLE, {
        matchedPolicy: workspaceDecision.matchedPolicy,
      });
    }
  }

  if (requiresProjectContext(input, definition) && projectIsMissing(input.project)) {
    return decision(input, NO_PROJECT);
  }

  if (definition.projectMembershipRequired && projectMembershipIsMissing(input.project)) {
    return decision(input, NOT_PROJECT_MEMBER);
  }

  if (legacyOwnershipUnresolved(input)) {
    return decision(input, LEGACY_OWNERSHIP_UNRESOLVED, {
      matchedPolicy: 'legacy-compatibility',
    });
  }

  if (ownershipConflict(input.resource)) {
    return decision(input, OWNERSHIP_CONFLICT);
  }

  if (workspaceScopeMismatch(input) || projectScopeMismatch(input)) {
    return decision(input, RESOURCE_SCOPE_MISMATCH);
  }

  if (input.explicitDeny === true || input.invariantDeny === true) {
    return decision(input, EXPLICIT_DENY, { matchedPolicy: 'explicit-deny' });
  }

  if (
    matchedPolicy === 'workspace' &&
    input.workspace?.isPersonal === true &&
    PERSONAL_WORKSPACE_DENIED_PERMISSIONS.includes(input.permission)
  ) {
    return decision(input, EXPLICIT_DENY, { matchedPolicy: 'workspace' });
  }

  if (matchedPolicy === 'workspace') {
    return decision(input, ALLOW, { matchedPolicy: 'workspace' });
  }

  return decision(input, EXPLICIT_DENY, { matchedPolicy });
}

export const evaluateDynaxisAuthorization = authorizeDynaxis;
