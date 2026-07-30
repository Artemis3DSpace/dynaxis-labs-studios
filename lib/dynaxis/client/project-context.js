/**
 * Lightweight active project/workspace context for the Dynaxis shell / studios.
 * Better Auth session activeOrganizationId is authoritative for workspace scope.
 * Broadcasts on window so query invalidation and lifecycle tracking can react.
 */

const STORAGE_KEY = 'dynaxis_active_project_id';
const WORKSPACE_HINT_KEY = 'dynaxis_active_workspace_hint';

const OWNER_REF_KEYS = ['owner_ref', 'ownerRef'];

/**
 * @param {Record<string, unknown>} scope
 */
export function assertNoOwnerRefInContext(scope = {}) {
  for (const key of OWNER_REF_KEYS) {
    if (scope[key] != null && scope[key] !== '') {
      throw new Error('owner_ref must not appear in Dynaxis client context');
    }
  }
}

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
 * Non-authoritative UI hint only. Session activeOrganizationId remains canonical.
 * @returns {string | null}
 */
export function getStoredWorkspaceHint() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(WORKSPACE_HINT_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist a non-authoritative workspace hint for UI restore only.
 * @param {string | null} organizationId
 */
export function setStoredWorkspaceHint(organizationId) {
  if (typeof window === 'undefined') return;
  try {
    if (organizationId) window.localStorage.setItem(WORKSPACE_HINT_KEY, organizationId);
    else window.localStorage.removeItem(WORKSPACE_HINT_KEY);
  } catch {
    // ignore
  }
}

/**
 * @deprecated Use hydrateWorkspaceContextFromSession. Does not write workspace authority.
 * @param {string | null} organizationId
 */
export function setStoredActiveWorkspaceId(organizationId) {
  setStoredWorkspaceHint(organizationId);
  publishWorkspaceContext({ organizationId });
}

/**
 * @returns {string | null}
 * @deprecated Prefer readWorkspaceContext().organizationId from session hydration.
 */
export function getStoredActiveWorkspaceId() {
  return getStoredWorkspaceHint();
}

/**
 * @param {{ organizationId?: string|null, userId?: string|null }} ctx
 */
export function publishWorkspaceContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  assertNoOwnerRefInContext(ctx);
  if (ctx.organizationId !== undefined) {
    window.__dynaxisOrganizationId = ctx.organizationId || null;
    setStoredWorkspaceHint(ctx.organizationId || null);
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
 * Hydrate in-memory workspace context from Better Auth session data.
 * @param {{ organizationId?: string|null, userId?: string|null }} sessionContext
 */
export function hydrateWorkspaceContextFromSession(sessionContext = {}) {
  assertNoOwnerRefInContext(sessionContext);
  publishWorkspaceContext({
    organizationId: sessionContext.organizationId ?? null,
    userId: sessionContext.userId ?? null,
  });
}

/**
 * @param {{ projectId?: string|null, featureId?: string|null, project?: object|null, organizationId?: string|null }} ctx
 */
export function publishProjectContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  assertNoOwnerRefInContext(ctx);
  if (ctx.projectId !== undefined) {
    window.__dynaxisProjectId = ctx.projectId || null;
    try {
      if (ctx.projectId) window.localStorage.setItem(STORAGE_KEY, String(ctx.projectId));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
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
        organizationId: window.__dynaxisOrganizationId || null,
        projectId: window.__dynaxisProjectId || null,
        featureId: window.__dynaxisFeatureId || null,
        project: window.__dynaxisProject || null,
      },
    })
  );
}

export function clearWorkspaceContext() {
  if (typeof window === 'undefined') return;
  window.__dynaxisOrganizationId = null;
  window.__dynaxisUserId = null;
  setStoredWorkspaceHint(null);
  publishWorkspaceContext({ organizationId: null, userId: null });
}

export function clearProjectContext() {
  if (typeof window === 'undefined') return;
  window.__dynaxisProjectId = null;
  window.__dynaxisFeatureId = null;
  window.__dynaxisProject = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  publishProjectContext({ projectId: null, featureId: null, project: null });
}

/**
 * @param {(detail: { organizationId: string | null, userId: string | null }) => void} listener
 */
export function subscribeWorkspaceContext(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event) => {
    listener({
      organizationId: event.detail?.organizationId ?? null,
      userId: event.detail?.userId ?? null,
    });
  };
  window.addEventListener('dynaxis:workspace-context', handler);
  return () => window.removeEventListener('dynaxis:workspace-context', handler);
}

/**
 * @param {(detail: { organizationId: string | null, projectId: string | null, featureId?: string | null, project?: object | null }) => void} listener
 */
export function subscribeProjectContext(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event) => {
    listener({
      organizationId: event.detail?.organizationId ?? null,
      projectId: event.detail?.projectId ?? null,
      featureId: event.detail?.featureId ?? null,
      project: event.detail?.project ?? null,
    });
  };
  window.addEventListener('dynaxis:project-context', handler);
  return () => window.removeEventListener('dynaxis:project-context', handler);
}

/**
 * Read workspace context hydrated from Better Auth session.
 */
export function readWorkspaceContext() {
  if (typeof window === 'undefined') {
    return { organizationId: null, userId: null };
  }
  return {
    organizationId: window.__dynaxisOrganizationId || null,
    userId: window.__dynaxisUserId || null,
  };
}

export function readProjectContext() {
  if (typeof window === 'undefined') {
    return { projectId: null, featureId: null, organizationId: null };
  }
  return {
    organizationId: window.__dynaxisOrganizationId || null,
    projectId: window.__dynaxisProjectId || getStoredActiveProjectId(),
    featureId: window.__dynaxisFeatureId || null,
  };
}
