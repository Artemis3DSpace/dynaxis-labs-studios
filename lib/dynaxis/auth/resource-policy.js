import 'server-only';
import { getPermissionDefinition } from './permissions.js';
import {
  EXPLICIT_DENY,
  NO_PROJECT,
  RESOURCE_SCOPE_MISMATCH,
  UNKNOWN_PERMISSION,
} from './policy.js';
import {
  authorizeProjectPolicy,
  getProjectPermissionRoles,
  isProjectPolicyPermission,
} from './project-policy.js';

export const DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME = 'resource-inheritance';

export const PROJECT_INHERITED_RESOURCE_TYPES = Object.freeze([
  'asset',
  'generation',
  'job',
  'project_character',
  'project_product',
  'project_brand',
  'campaign',
  'composition',
  'design',
]);

const RESOURCE_TYPE_ALIASES = Object.freeze({
  asset: Object.freeze(['asset']),
  generation: Object.freeze(['generation']),
  job: Object.freeze(['job']),
  character: Object.freeze(['project_character', 'character_use']),
  product: Object.freeze(['project_product', 'product_use']),
  brand: Object.freeze(['project_brand', 'brand_use']),
  campaign: Object.freeze(['campaign']),
  composition: Object.freeze(['composition']),
  design: Object.freeze([
    'design',
    'composition',
    'design_surface',
    'design_resource',
  ]),
  settings: Object.freeze(['settings', 'project_settings']),
});

function decision(input, reason, extras = {}) {
  return {
    allowed: reason === 'ALLOW',
    reason,
    permission: input?.permission,
    matchedPolicy:
      reason === 'ALLOW' ? DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME : extras.matchedPolicy,
    ...(input?.workspace?.organizationId ? { workspaceId: input.workspace.organizationId } : {}),
    ...(input?.project?.projectId ? { projectId: input.project.projectId } : {}),
    ...(extras.resourceType ? { resourceType: extras.resourceType } : {}),
    ...(extras.resourceId ? { resourceId: extras.resourceId } : {}),
    ...(extras.status ? { status: extras.status } : {}),
    ...(extras.failureKind ? { failureKind: extras.failureKind } : {}),
    ...(extras.requiredRoles ? { requiredRoles: extras.requiredRoles } : {}),
    ...(extras.role ? { role: extras.role } : {}),
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function permissionDomain(permission) {
  return String(permission || '').split('.')[0];
}

function expectedResourceTypes(permission) {
  const domain = permissionDomain(permission);
  return RESOURCE_TYPE_ALIASES[domain] || Object.freeze([]);
}

function normalizeResourceType(resource) {
  return normalizeId(resource?.type || resource?.resourceType);
}

function normalizeProjectId(project) {
  return normalizeId(project?.projectId || project?.id);
}

function normalizeResourceProjectId(resource) {
  return normalizeId(resource?.projectId || resource?.project?.projectId || resource?.project?.id);
}

function normalizeWorkspaceId(workspace) {
  return normalizeId(workspace?.organizationId);
}

function normalizeProjectWorkspaceId(project) {
  return normalizeId(project?.organizationId);
}

function normalizeResourceWorkspaceId(resource) {
  return normalizeId(resource?.organizationId || resource?.project?.organizationId);
}

function resourceId(resource) {
  return normalizeId(resource?.id || resource?.resourceId);
}

function isCreatePermission(permission) {
  return String(permission || '').endsWith('.create');
}

function isProjectScopedDesignOrSettings(permission) {
  return (
    String(permission || '').startsWith('design.') ||
    permission === 'settings.read' ||
    permission === 'settings.manage'
  );
}

function isProjectInheritedPermission(permission, input = {}) {
  const definition = getPermissionDefinition(permission);
  if (!definition) return false;
  if (definition.policyLayer === DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME) return true;
  return isProjectPolicyPermission(permission, input);
}

function resourceTypeMatchesPermission(permission, resource) {
  if (isCreatePermission(permission) && !resource) {
    return true;
  }
  const type = normalizeResourceType(resource);
  if (!type) {
    return isCreatePermission(permission);
  }
  const expected = expectedResourceTypes(permission);
  return expected.includes(type);
}

async function resolveResource(input) {
  if (input.resource === null || input.resource?.notFound === true) {
    return null;
  }
  if (input.resource) {
    return input.resource;
  }
  if (!input.resourceRepository || !input.resourceId) {
    return undefined;
  }
  return input.resourceRepository.findResource({
    type: input.resourceType || permissionDomain(input.permission),
    id: input.resourceId,
  });
}

function scopeMismatch({ workspace, project, resource }) {
  const workspaceId = normalizeWorkspaceId(workspace);
  const projectId = normalizeProjectId(project);
  const projectWorkspaceId = normalizeProjectWorkspaceId(project);
  const resourceWorkspaceId = normalizeResourceWorkspaceId(resource);
  const resourceProjectId = normalizeResourceProjectId(resource);

  if (workspaceId && projectWorkspaceId && workspaceId !== projectWorkspaceId) {
    return true;
  }
  if (resourceWorkspaceId && workspaceId && resourceWorkspaceId !== workspaceId) {
    return true;
  }
  if (resourceProjectId && projectId && resourceProjectId !== projectId) {
    return true;
  }
  return false;
}

function hasResourceProjectContext(permission, project, resource) {
  if (isCreatePermission(permission)) {
    return Boolean(normalizeProjectId(project));
  }
  return Boolean(normalizeProjectId(project) && normalizeResourceProjectId(resource));
}

async function resolveResourceScope(input = {}) {
  const definition = getPermissionDefinition(input.permission);
  if (!definition) {
    return decision(input, UNKNOWN_PERMISSION, { status: 400, failureKind: 'invalid' });
  }

  if (!isProjectInheritedPermission(input.permission, input)) {
    return decision(input, EXPLICIT_DENY, {
      status: 403,
      failureKind: 'forbidden',
      matchedPolicy: DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME,
    });
  }

  const resource = await resolveResource(input);
  const resourceType = normalizeResourceType(resource) || input.resourceType || permissionDomain(input.permission);
  const resolvedResourceId = resourceId(resource) || input.resourceId;

  if (resource === null) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
      resourceType,
      resourceId: resolvedResourceId,
    });
  }

  if (!resourceTypeMatchesPermission(input.permission, resource)) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
      resourceType,
      resourceId: resolvedResourceId,
    });
  }

  if (!hasResourceProjectContext(input.permission, input.project, resource)) {
    return decision(input, NO_PROJECT, {
      status: 404,
      failureKind: 'not-found',
      resourceType,
      resourceId: resolvedResourceId,
    });
  }

  if (scopeMismatch({ workspace: input.workspace, project: input.project, resource })) {
    return decision(input, RESOURCE_SCOPE_MISMATCH, {
      status: 404,
      failureKind: 'not-found',
      resourceType,
      resourceId: resolvedResourceId,
    });
  }

  return {
    allowed: true,
    reason: 'ALLOW',
    permission: input.permission,
    matchedPolicy: DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME,
    workspaceId: normalizeWorkspaceId(input.workspace),
    projectId: normalizeProjectId(input.project),
    resourceType,
    ...(resolvedResourceId ? { resourceId: resolvedResourceId } : {}),
  };
}

export async function evaluateResourceInheritancePolicy(input = {}) {
  const definition = getPermissionDefinition(input.permission);
  if (!definition || !isProjectInheritedPermission(input.permission, input)) {
    return resolveResourceScope(input);
  }

  const projectMembershipDecision = await authorizeProjectPolicy({
    ...input,
    permission: 'project.read',
  });
  if (!projectMembershipDecision.allowed) {
    const resource = input.resource || {};
    const resourceType =
      normalizeResourceType(resource) || input.resourceType || permissionDomain(input.permission);
    const resolvedResourceId = resourceId(resource) || input.resourceId;
    return {
      ...projectMembershipDecision,
      permission: input.permission,
      resourceType,
      ...(resolvedResourceId ? { resourceId: resolvedResourceId } : {}),
    };
  }

  const inheritanceDecision = await resolveResourceScope(input);
  if (!inheritanceDecision.allowed) {
    return inheritanceDecision;
  }

  const projectDecision = await authorizeProjectPolicy(input);
  if (!projectDecision.allowed) {
    return {
      ...projectDecision,
      matchedPolicy: projectDecision.matchedPolicy || DYNAXIS_RESOURCE_INHERITANCE_POLICY_NAME,
      resourceType: inheritanceDecision.resourceType,
      ...(inheritanceDecision.resourceId ? { resourceId: inheritanceDecision.resourceId } : {}),
    };
  }

  return {
    ...inheritanceDecision,
    status: 200,
    requiredRoles: getProjectPermissionRoles(input.permission, input),
    ...(projectDecision.role ? { role: projectDecision.role } : {}),
  };
}

export async function resolveResourceInheritance(input = {}) {
  return evaluateResourceInheritancePolicy(input);
}

export const authorizeResourceInheritance = evaluateResourceInheritancePolicy;
