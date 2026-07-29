/**
 * Dynaxis Project service — persistent projects with Default Project resolution.
 *
 * Canonical AuthContext flow uses WP-7C-24 store APIs (owner_ref NULL + explicit
 * Project membership). Legacy owner_ref flow remains available for explicit
 * route-level legacyCompatibility only.
 */

import { z } from 'zod';
import {
  AUTH_CONTEXT_ERROR_CODES,
  AuthContextError,
  assertAuthContextPermission,
} from '../auth/auth-context.js';
import { getPlatformStore } from '../db/store.js';
import { createProjectMembershipService } from '../identity/project-membership.js';
import { resolveWorkspaceOrganizationForLegacyWrite } from '../identity/workspace-ownership.js';
import { DEFAULT_PROJECT_NAME } from '../types.js';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function requireCanonicalWorkspace(authContext) {
  const organizationId = String(authContext?.workspace?.organizationId || '').trim();
  if (!organizationId || authContext?.workspace?.isMember !== true) {
    throw new AuthContextError('Workspace access required', {
      code: AUTH_CONTEXT_ERROR_CODES.WORKSPACE_REQUIRED,
      status: 403,
    });
  }
  return organizationId;
}

function requireCanonicalUserId(authContext) {
  const userId = String(authContext?.principal?.userId || '').trim();
  if (!userId) {
    throw new AuthContextError('Authentication required', {
      code: AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED,
      status: 401,
    });
  }
  return userId;
}

export function isLegacyRouteCompatibility(routeContext) {
  return routeContext?.legacyCompatibility?.used === true;
}

export function legacyOwnerRefFromRoute(routeContext) {
  const ownerRef = String(routeContext?.legacyCompatibility?.ownerRef || '').trim();
  return ownerRef || null;
}

/**
 * Ensure the owner has a Default Project (non-disruptive migration path).
 * @param {string} ownerRef
 */
export async function ensureDefaultProject(ownerRef) {
  const store = await getPlatformStore();
  const existing = await store.getDefaultProject(ownerRef);
  if (existing) {
    if (existing.status === 'archived') {
      return store.updateProject(ownerRef, existing.id, { status: 'active' });
    }
    return existing;
  }
  const organizationId = await resolveWorkspaceOrganizationForLegacyWrite(ownerRef);
  return store.createProject({
    ownerRef,
    organizationId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Automatically created for generations before an explicit project is selected.',
    status: 'active',
    isDefault: true,
    metadata: { system: true, kind: 'default' },
  });
}

/**
 * Resolve active project: explicit id (owned) or Default Project.
 * @param {string} ownerRef
 * @param {string | null | undefined} projectId
 */
export async function resolveProjectId(ownerRef, projectId) {
  const store = await getPlatformStore();
  if (projectId) {
    const project = await store.getProject(ownerRef, projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.code = 'PROJECT_NOT_FOUND';
      throw err;
    }
    if (project.status === 'archived') {
      const err = new Error('Project is archived');
      err.status = 400;
      err.code = 'PROJECT_ARCHIVED';
      throw err;
    }
    return project;
  }
  return ensureDefaultProject(ownerRef);
}

export async function createProject(ownerRef, input) {
  const data = createProjectSchema.parse(input);
  const store = await getPlatformStore();
  const organizationId = await resolveWorkspaceOrganizationForLegacyWrite(ownerRef);
  return store.createProject({
    ownerRef,
    organizationId,
    name: data.name,
    description: data.description ?? null,
    status: 'active',
    isDefault: false,
    metadata: data.metadata || {},
  });
}

export async function getProject(ownerRef, id) {
  const store = await getPlatformStore();
  return store.getProject(ownerRef, id);
}

export async function listProjects(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listProjects(ownerRef, opts);
}

export async function updateProject(ownerRef, id, input) {
  const data = updateProjectSchema.parse(input);
  const store = await getPlatformStore();
  const existing = await store.getProject(ownerRef, id);
  if (!existing) return null;
  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  return store.updateProject(ownerRef, id, patch);
}

export async function archiveProject(ownerRef, id) {
  return updateProject(ownerRef, id, { status: 'archived' });
}

/**
 * Membership-scoped Default Project for a canonical Better Auth principal.
 * Never invents owner_ref; uses WP-7C-24 createCanonicalProject / default APIs.
 */
export async function ensureCanonicalDefaultProject(authContext) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const userId = requireCanonicalUserId(authContext);
  const store = await getPlatformStore();
  const existing = await store.getCanonicalDefaultProjectForUser({ organizationId, userId });
  if (existing) {
    if (existing.status === 'archived') {
      // Membership already proven by getCanonicalDefaultProjectForUser.
      return store.updateCanonicalProject(
        { projectId: existing.id, organizationId },
        { status: 'active' }
      );
    }
    return existing;
  }

  // Creating a Workspace Default Project requires project.create (Workspace admin).
  await assertAuthContextPermission(authContext, 'project.create');
  const { project } = await store.createCanonicalProject({
    organizationId,
    userId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Automatically created for generations before an explicit project is selected.',
    status: 'active',
    isDefault: true,
    metadata: { system: true, kind: 'default' },
  });
  return project;
}

export async function listCanonicalProjects(authContext, opts = {}) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const userId = requireCanonicalUserId(authContext);
  const includeArchived = opts.includeArchived === true;
  if (opts.ensureDefault !== false) {
    await ensureCanonicalDefaultProject(authContext);
  }
  const store = await getPlatformStore();
  return store.listCanonicalProjectsForUser({ organizationId, userId, includeArchived });
}

export async function createCanonicalProjectForAuthContext(authContext, input) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const userId = requireCanonicalUserId(authContext);
  const data = createProjectSchema.parse(input);
  const store = await getPlatformStore();
  const { project } = await store.createCanonicalProject({
    organizationId,
    userId,
    name: data.name,
    description: data.description ?? null,
    status: 'active',
    isDefault: false,
    metadata: data.metadata || {},
  });
  return project;
}

export async function getCanonicalProjectForAuthContext(authContext, projectId) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(projectId);
  if (!project || project.organizationId !== organizationId) {
    return null;
  }
  return project;
}

export async function updateCanonicalProjectForAuthContext(authContext, projectId, input) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const data = updateProjectSchema.parse(input);
  const store = await getPlatformStore();
  const existing = await store.getCanonicalProject(projectId);
  if (!existing || existing.organizationId !== organizationId) {
    return null;
  }
  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  return store.updateCanonicalProject({ projectId, organizationId }, patch);
}

export async function archiveCanonicalProjectForAuthContext(authContext, projectId) {
  return updateCanonicalProjectForAuthContext(authContext, projectId, { status: 'archived' });
}

export async function listProjectsForRoute(routeContext, opts = {}) {
  if (isLegacyRouteCompatibility(routeContext)) {
    const ownerRef = legacyOwnerRefFromRoute(routeContext);
    if (opts.ensureDefault !== false) {
      await ensureDefaultProject(ownerRef);
    }
    return listProjects(ownerRef, { includeArchived: opts.includeArchived === true });
  }
  return listCanonicalProjects(routeContext.authContext, opts);
}

export async function createProjectForRoute(routeContext, input) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return createProject(legacyOwnerRefFromRoute(routeContext), input);
  }
  return createCanonicalProjectForAuthContext(routeContext.authContext, input);
}

export async function getProjectForRoute(routeContext, projectId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return getProject(legacyOwnerRefFromRoute(routeContext), projectId);
  }
  return getCanonicalProjectForAuthContext(routeContext.authContext, projectId);
}

export async function updateProjectForRoute(routeContext, projectId, input) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return updateProject(legacyOwnerRefFromRoute(routeContext), projectId, input);
  }
  return updateCanonicalProjectForAuthContext(routeContext.authContext, projectId, input);
}

export async function archiveProjectForRoute(routeContext, projectId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return archiveProject(legacyOwnerRefFromRoute(routeContext), projectId);
  }
  return archiveCanonicalProjectForAuthContext(routeContext.authContext, projectId);
}

export const projectServiceImpl = {
  create: createProject,
  get: getProject,
  list: listProjects,
  update: updateProject,
  archive: archiveProject,
  ensureDefault: ensureDefaultProject,
  resolve: resolveProjectId,
  memberships: createProjectMembershipService(),
  listCanonical: listCanonicalProjects,
  createCanonical: createCanonicalProjectForAuthContext,
  getCanonical: getCanonicalProjectForAuthContext,
  updateCanonical: updateCanonicalProjectForAuthContext,
  archiveCanonical: archiveCanonicalProjectForAuthContext,
};
