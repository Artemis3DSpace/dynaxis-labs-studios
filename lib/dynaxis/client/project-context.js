/**
 * Lightweight active project context for the Dynaxis shell / studios.
 * Broadcasts on window so muapi.js lifecycle tracking can read projectId.
 */

const STORAGE_KEY = 'dynaxis_active_project_id';

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
 * @param {{ projectId?: string|null, featureId?: string|null, project?: object|null }} ctx
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
export function readProjectContext() {
  if (typeof window === 'undefined') {
    return { projectId: null, featureId: null };
  }
  return {
    projectId: window.__dynaxisProjectId || getStoredActiveProjectId(),
    featureId: window.__dynaxisFeatureId || null,
  };
}
