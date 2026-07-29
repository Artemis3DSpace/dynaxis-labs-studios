/**
 * Dynaxis Project service — persistent projects with Default Project resolution.
 */

import { z } from 'zod';
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

function textOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function legacyOwnerRefFromAuthContext(authContext) {
  return (
    textOrNull(authContext?.compatibility?.ownerRef) ||
    textOrNull(authContext?.subject?.legacyOwnerRef)
  );
}

function requireCanonicalProjectScope(authContext) {
  const organizationId = textOrNull(authContext?.workspace?.organizationId);
  if (!organizationId) {
    throw Object.assign(new Error('Workspace access required'), {
      status: 403,
      code: 'WORKSPACE_REQUIRED',
    });
  }
  const userId = textOrNull(authContext?.principal?.userId);
  if (!userId) {
    throw Object.assign(new Error('Authenticated user principal required'), {
      status: 403,
      code: 'AUTH_CONTEXT_PRINCIPAL_REQUIRED',
    });
  }
  return { organizationId, userId };
}

const projectMembershipService = createProjectMembershipService();

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

export async function ensureDefaultProjectForAuthContext(authContext) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return ensureDefaultProject(legacyOwnerRef);
  }
  const scope = requireCanonicalProjectScope(authContext);
  const store = await getPlatformStore();
  const existing = await store.getCanonicalDefaultProjectForUser(scope);
  if (existing) {
    if (existing.status === 'archived') {
      return store.updateCanonicalProject(
        { projectId: existing.id, organizationId: scope.organizationId },
        { status: 'active' }
      );
    }
    return existing;
  }
  const { project } = await store.createCanonicalProject({
    organizationId: scope.organizationId,
    userId: scope.userId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Automatically created for generations before an explicit project is selected.',
    status: 'active',
    isDefault: true,
    metadata: { system: true, kind: 'default' },
  });
  return project;
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

export async function resolveProjectForAuthContext(authContext, projectId) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return resolveProjectId(legacyOwnerRef, projectId);
  }
  const id = textOrNull(projectId);
  if (id) {
    const project = await getProjectForAuthContext(authContext, id);
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
  return ensureDefaultProjectForAuthContext(authContext);
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

export async function listProjectsForAuthContext(authContext, opts = {}) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return listProjects(legacyOwnerRef, opts);
  }
  const scope = requireCanonicalProjectScope(authContext);
  if (opts.ensureDefault !== false) {
    await ensureDefaultProjectForAuthContext(authContext);
  }
  const store = await getPlatformStore();
  return store.listCanonicalProjectsForUser({
    organizationId: scope.organizationId,
    userId: scope.userId,
    includeArchived: opts.includeArchived === true,
  });
}

export async function createProjectForAuthContext(authContext, input) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return createProject(legacyOwnerRef, input);
  }
  const scope = requireCanonicalProjectScope(authContext);
  const data = createProjectSchema.parse(input);
  const store = await getPlatformStore();
  const { project } = await store.createCanonicalProject({
    organizationId: scope.organizationId,
    userId: scope.userId,
    name: data.name,
    description: data.description ?? null,
    status: 'active',
    isDefault: false,
    metadata: data.metadata || {},
  });
  return project;
}

export async function getProjectForAuthContext(authContext, id) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return getProject(legacyOwnerRef, id);
  }
  const scope = requireCanonicalProjectScope(authContext);
  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(id);
  if (!project || project.organizationId !== scope.organizationId) {
    return null;
  }
  try {
    const membership = await projectMembershipService.get({
      projectId: id,
      organizationId: scope.organizationId,
      userId: scope.userId,
    });
    return membership ? project : null;
  } catch (err) {
    if (err?.status === 404 || err?.status === 409) {
      return null;
    }
    throw err;
  }
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

export async function updateProjectForAuthContext(authContext, id, input) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return updateProject(legacyOwnerRef, id, input);
  }
  const scope = requireCanonicalProjectScope(authContext);
  const existing = await getProjectForAuthContext(authContext, id);
  if (!existing) return null;
  const data = updateProjectSchema.parse(input);
  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  const store = await getPlatformStore();
  return store.updateCanonicalProject({ projectId: id, organizationId: scope.organizationId }, patch);
}

export async function archiveProject(ownerRef, id) {
  return updateProject(ownerRef, id, { status: 'archived' });
}

export async function archiveProjectForAuthContext(authContext, id) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return archiveProject(legacyOwnerRef, id);
  }
  return updateProjectForAuthContext(authContext, id, { status: 'archived' });
}

export const projectServiceImpl = {
  create: createProject,
  get: getProject,
  list: listProjects,
  update: updateProject,
  archive: archiveProject,
  ensureDefault: ensureDefaultProject,
  resolve: resolveProjectId,
  createForAuthContext: createProjectForAuthContext,
  getForAuthContext: getProjectForAuthContext,
  listForAuthContext: listProjectsForAuthContext,
  updateForAuthContext: updateProjectForAuthContext,
  archiveForAuthContext: archiveProjectForAuthContext,
  ensureDefaultForAuthContext: ensureDefaultProjectForAuthContext,
  resolveForAuthContext: resolveProjectForAuthContext,
  memberships: projectMembershipService,
};
