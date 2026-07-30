/**
 * Session and workspace switching controller for Dynaxis Studio.
 * Better Auth session activeOrganizationId is authoritative; local hints are non-authoritative.
 */

import {
  fetchDynaxisAuthSession,
  projectDynaxisSessionContext,
  resolveSessionOrganizationId,
  resolveSessionUserId,
  switchDynaxisActiveOrganization,
} from '../../../../lib/dynaxis/auth/client.js';
import {
  clearProjectContext,
  clearWorkspaceContext,
  hydrateWorkspaceContextFromSession,
  publishProjectContext,
  readProjectContext,
  readWorkspaceContext,
} from '../../../../lib/dynaxis/client/project-context.js';
import {
  onProjectContextChanged,
  onWorkspaceContextChanged,
  resetWorkspaceQueryCache,
} from '../query/invalidation.js';

/**
 * @typedef {Object} WorkspaceSessionState
 * @property {string | null} organizationId
 * @property {string | null} userId
 * @property {string | null} projectId
 * @property {boolean} hasSession
 */

/**
 * @param {{
 *   authClient?: import('../../../../lib/dynaxis/auth/client.js').dynaxisAuthClient,
 *   queryClient?: import('@tanstack/react-query').QueryClient | null,
 *   fetchSession?: typeof fetchDynaxisAuthSession,
 *   switchOrganization?: typeof switchDynaxisActiveOrganization,
 * }} [deps]
 */
export function createWorkspaceSessionController(deps = {}) {
  const authClient = deps.authClient;
  const queryClient = deps.queryClient ?? null;
  const fetchSession = deps.fetchSession ?? ((client) => fetchDynaxisAuthSession(client || authClient));
  const switchOrganization =
    deps.switchOrganization ??
    ((organizationId, client) => switchDynaxisActiveOrganization(organizationId, client || authClient));

  /** @type {WorkspaceSessionState} */
  let state = {
    organizationId: null,
    userId: null,
    projectId: null,
    hasSession: false,
  };

  /** @type {Set<(next: WorkspaceSessionState) => void>} */
  const listeners = new Set();

  function syncFromDom() {
    const workspace = readWorkspaceContext();
    const project = readProjectContext();
    state = {
      organizationId: workspace.organizationId,
      userId: workspace.userId,
      projectId: project.projectId,
      hasSession: Boolean(workspace.userId),
    };
    return state;
  }

  function notify() {
    for (const listener of listeners) {
      listener({ ...state });
    }
  }

  /**
   * @param {Record<string, unknown> | null | undefined} sessionPayload
   */
  async function hydrateFromSession(sessionPayload) {
    const projected = projectDynaxisSessionContext(sessionPayload);
    const previousOrganizationId = state.organizationId;

    if (!projected.hasSession) {
      clearWorkspaceContext();
      clearProjectContext();
      state = {
        organizationId: null,
        userId: null,
        projectId: null,
        hasSession: false,
      };
      if (queryClient) {
        await resetWorkspaceQueryCache(queryClient);
      }
      notify();
      return { ...state };
    }

    hydrateWorkspaceContextFromSession({
      organizationId: projected.organizationId,
      userId: projected.userId,
    });

    if (
      previousOrganizationId &&
      projected.organizationId &&
      previousOrganizationId !== projected.organizationId
    ) {
      clearProjectContext();
      if (queryClient) {
        await onWorkspaceContextChanged(queryClient, {
          organizationId: projected.organizationId,
          previousOrganizationId,
        });
      }
    }

    syncFromDom();
    notify();
    return { ...state };
  }

  /**
   * @param {string} organizationId
   */
  async function switchWorkspace(organizationId) {
    const previousOrganizationId = state.organizationId;
    await switchOrganization(organizationId, authClient);
    const sessionPayload = await fetchSession(authClient);
    const projected = projectDynaxisSessionContext(sessionPayload);

    clearProjectContext();
    hydrateWorkspaceContextFromSession({
      organizationId: projected.organizationId || organizationId,
      userId: projected.userId,
    });

    if (queryClient) {
      await onWorkspaceContextChanged(queryClient, {
        organizationId: projected.organizationId || organizationId,
        previousOrganizationId,
      });
    }

    syncFromDom();
    notify();
    return { ...state };
  }

  /**
   * @param {string | null} projectId
   * @param {{ organizationId?: string | null }} [scope]
   */
  async function switchProject(projectId, scope = {}) {
    const organizationId =
      scope.organizationId || state.organizationId || readWorkspaceContext().organizationId;
    if (!organizationId) {
      throw new Error('organizationId is required to switch Dynaxis project context');
    }

    const previousProjectId = state.projectId;
    publishProjectContext({
      organizationId,
      projectId: projectId || null,
      project: null,
      featureId: null,
    });

    if (queryClient) {
      await onProjectContextChanged(queryClient, {
        organizationId,
        projectId: projectId || null,
        previousProjectId,
      });
    }

    syncFromDom();
    notify();
    return { ...state };
  }

  async function clearSessionContext() {
    return hydrateFromSession(null);
  }

  /**
   * @param {(next: WorkspaceSessionState) => void} listener
   */
  function subscribe(listener) {
    listeners.add(listener);
    listener({ ...state });
    return () => listeners.delete(listener);
  }

  function readState() {
    return { ...syncFromDom() };
  }

  return {
    hydrateFromSession,
    switchWorkspace,
    switchProject,
    clearSessionContext,
    subscribe,
    readState,
  };
}

export {
  fetchDynaxisAuthSession,
  projectDynaxisSessionContext,
  resolveSessionOrganizationId,
  resolveSessionUserId,
};
