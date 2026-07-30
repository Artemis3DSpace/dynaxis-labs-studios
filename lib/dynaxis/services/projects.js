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
 * Ensure the authenticated Workspace member has a canonical Default Project.
 * @param {{ organizationId: string, userId: string }} scope
 */
export async function ensureCanonicalDefaultProject({ organizationId, userId }) {
  const store = await getPlatformStore();
  const existing = await store.getCanonicalDefaultProjectForUser({ organizationId, userId });
  if (existing) {
    if (existing.status === 'archived') {
      return store.updateCanonicalProject(
        { projectId: existing.id, organizationId },
        { status: 'active' }
      );
    }
    return existing;
  }
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

/**
 * Resolve an active canonical Project for Asset and generation flows.
 * @param {{ organizationId: string, userId: string, projectId?: string | null }} scope
 */
export async function resolveCanonicalProjectId({ organizationId, userId, projectId }) {
  const store = await getPlatformStore();
  if (projectId) {
    const project = await store.getCanonicalProject(projectId);
    if (!project || project.organizationId !== organizationId) {
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
  return ensureCanonicalDefaultProject({ organizationId, userId });
}

export async function createCanonicalProjectForUser({ organizationId, userId, input }) {
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

export async function getCanonicalProjectInWorkspace({ organizationId, projectId }) {
  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(projectId);
  if (!project || project.organizationId !== organizationId) {
    return null;
  }
  return project;
}

export async function listCanonicalProjectsForUser({ organizationId, userId, includeArchived = false }) {
  const store = await getPlatformStore();
  return store.listCanonicalProjectsForUser({ organizationId, userId, includeArchived });
}

export async function updateCanonicalProjectInWorkspace({ organizationId, projectId, input }) {
  const data = updateProjectSchema.parse(input);
  const store = await getPlatformStore();
  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  return store.updateCanonicalProject({ projectId, organizationId }, patch);
}

export async function archiveCanonicalProjectInWorkspace({ organizationId, projectId }) {
  return updateCanonicalProjectInWorkspace({ organizationId, projectId, input: { status: 'archived' } });
}

export const projectServiceImpl = {
  create: createProject,
  get: getProject,
  list: listProjects,
  update: updateProject,
  archive: archiveProject,
  ensureDefault: ensureDefaultProject,
  resolve: resolveProjectId,
  ensureCanonicalDefault: ensureCanonicalDefaultProject,
  resolveCanonical: resolveCanonicalProjectId,
  createCanonical: createCanonicalProjectForUser,
  getCanonical: getCanonicalProjectInWorkspace,
  listCanonical: listCanonicalProjectsForUser,
  updateCanonical: updateCanonicalProjectInWorkspace,
  archiveCanonical: archiveCanonicalProjectInWorkspace,
  memberships: createProjectMembershipService(),
};
