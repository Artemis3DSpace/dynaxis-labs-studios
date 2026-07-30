/**
 * Lightweight active project context for the Dynaxis shell / studios.
 * Broadcasts on window so muapi.js lifecycle tracking can read projectId.
 */

const STORAGE_KEY = 'dynaxis_active_project_id';
const WORKSPACE_STORAGE_KEY = 'dynaxis_active_workspace_id';

/**
 * @returns {string | null}
 */
export function getStoredActiveProjectId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string | null} projectId
 */
export function setStoredActiveProjectId(projectId) {
  if (typeof window === 'undefined') return;
  try {
    if (projectId) window.localStorage.setItem(STORAGE_KEY, projectId);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  publishProjectContext({ projectId });
}

/**
 * @returns {string | null}
 */
export function getStoredActiveWorkspaceId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string | null} organizationId
 */
export function setStoredActiveWorkspaceId(organizationId) {
  if (typeof window === 'undefined') return;
  try {
    if (organizationId) window.localStorage.setItem(WORKSPACE_STORAGE_KEY, organizationId);
    else window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // ignore
  }
  publishWorkspaceContext({ organizationId });
}

/**
 * @param {{ organizationId?: string|null, userId?: string|null }} ctx
 */
export function publishWorkspaceContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  if (ctx.organizationId !== undefined) {
    window.__dynaxisOrganizationId = ctx.organizationId || null;
  }
  if (ctx.userId !== undefined) {
    window.__dynaxisUserId = ctx.userId || null;
  }
  window.dispatchEvent(
    new CustomEvent('dynaxis:workspace-context', {
      detail: {
        organizationId: window.__dynaxisOrganizationId || null,
        userId: window.__dynaxisUserId || null,
      },
    })
  );
}

/**
 * @param {{ projectId?: string|null, featureId?: string|null, project?: object|null, organizationId?: string|null }} ctx
 */
export function publishProjectContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  if (ctx.projectId !== undefined) {
    window.__dynaxisProjectId = ctx.projectId || null;
  }
  if (ctx.featureId !== undefined) {
    window.__dynaxisFeatureId = ctx.featureId || null;
  }
  if (ctx.project !== undefined) {
    window.__dynaxisProject = ctx.project || null;
  }
  window.dispatchEvent(
    new CustomEvent('dynaxis:project-context', {
      detail: {
        organizationId: window.__dynaxisOrganizationId || getStoredActiveWorkspaceId(),
        projectId: window.__dynaxisProjectId || null,
        featureId: window.__dynaxisFeatureId || null,
        project: window.__dynaxisProject || null,
      },
    })
  );
}

/**
 * Read context available to generation tracking.
 */
export function readWorkspaceContext() {
  if (typeof window === 'undefined') {
    return { organizationId: null, userId: null };
  }
  return {
    organizationId: window.__dynaxisOrganizationId || getStoredActiveWorkspaceId(),
    userId: window.__dynaxisUserId || null,
  };
}

export function readProjectContext() {
  if (typeof window === 'undefined') {
    return { projectId: null, featureId: null, organizationId: null };
  }
  return {
    organizationId: window.__dynaxisOrganizationId || getStoredActiveWorkspaceId(),
    projectId: window.__dynaxisProjectId || getStoredActiveProjectId(),
    featureId: window.__dynaxisFeatureId || null,
  };
}
