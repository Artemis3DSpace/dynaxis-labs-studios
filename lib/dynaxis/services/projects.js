/**
 * Dynaxis Project service — persistent projects with Default Project resolution.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
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
  return store.createProject({
    ownerRef,
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
  return store.createProject({
    ownerRef,
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

export const projectServiceImpl = {
  create: createProject,
  get: getProject,
  list: listProjects,
  update: updateProject,
  archive: archiveProject,
  ensureDefault: ensureDefaultProject,
  resolve: resolveProjectId,
};
