/**
 * Project selection helpers for Studio session bootstrap.
 */

import { getStoredActiveProjectId } from '../../../../lib/dynaxis/client/project-context.js';

/**
 * @param {Array<{ id?: string, isDefault?: boolean }>} projects
 * @param {{ storedProjectId?: string | null }} [opts]
 */
export function resolvePreferredProject(projects, opts = {}) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return null;
  }
  const storedProjectId = opts.storedProjectId ?? getStoredActiveProjectId();
  return (
    projects.find((project) => project.id === storedProjectId) ||
    projects.find((project) => project.isDefault) ||
    projects[0] ||
    null
  );
}

/**
 * @param {string | null | undefined} organizationId
 * @param {string | null | undefined} projectOrganizationId
 */
export function isProjectInWorkspace(organizationId, projectOrganizationId) {
  if (!organizationId || !projectOrganizationId) {
    return false;
  }
  return String(organizationId) === String(projectOrganizationId);
}

/**
 * @param {Array<{ id?: string, organizationId?: string }>} projects
 * @param {string} organizationId
 */
export function filterProjectsForWorkspace(projects, organizationId) {
  if (!organizationId) {
    return [];
  }
  return projects.filter((project) => {
    if (project.organizationId) {
      return isProjectInWorkspace(organizationId, project.organizationId);
    }
    return true;
  });
}
