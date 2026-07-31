/**
 * Session-scoped Project API helpers for Studio query hooks.
 */

import {
  sessionArchiveProject,
  sessionCreateProject,
  sessionGetProject,
  sessionListProjects,
  sessionUpdateProject,
} from '../../../../lib/dynaxis/client/platform-api.js';
import { assertNoOwnerRefScope } from '../query/scope.js';

/**
 * @param {{ includeArchived?: boolean, ensureDefault?: boolean }} [filters]
 */
export function normalizeProjectListFilters(filters = {}) {
  assertNoOwnerRefScope(filters);
  return {
    includeArchived: filters.includeArchived === true,
    ensureDefault: filters.ensureDefault !== false,
  };
}

/**
 * @param {string} organizationId
 * @param {{ includeArchived?: boolean, ensureDefault?: boolean }} [filters]
 */
export async function fetchWorkspaceProjects(organizationId, filters = {}) {
  if (!organizationId) {
    return [];
  }
  const normalized = normalizeProjectListFilters(filters);
  const projects = await sessionListProjects(normalized);
  return projects.filter(
    (project) =>
      !project.organizationId || String(project.organizationId) === String(organizationId)
  );
}

/**
 * @param {string} organizationId
 * @param {string} projectId
 */
export async function fetchWorkspaceProjectDetail(organizationId, projectId) {
  if (!organizationId || !projectId) {
    return null;
  }
  const project = await sessionGetProject(projectId);
  if (project?.organizationId && String(project.organizationId) !== String(organizationId)) {
    return null;
  }
  return project;
}

export {
  sessionArchiveProject,
  sessionCreateProject,
  sessionGetProject,
  sessionListProjects,
  sessionUpdateProject,
};
