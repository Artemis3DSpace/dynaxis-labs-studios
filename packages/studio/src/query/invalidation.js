/**
 * TanStack Query invalidation helpers keyed by workspace/project scope.
 */

import { dynaxisQueryKeys } from './keys.js';

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} organizationId
 */
export function invalidateWorkspaceQueries(queryClient, organizationId) {
  return queryClient.invalidateQueries({
    queryKey: dynaxisQueryKeys.workspace(organizationId),
  });
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} organizationId
 * @param {string} projectId
 */
export function invalidateProjectQueries(queryClient, organizationId, projectId) {
  return queryClient.invalidateQueries({
    queryKey: [
      ...dynaxisQueryKeys.workspace(organizationId),
      'project',
      String(projectId),
    ],
  });
}

/**
 * Remove cached queries when switching Workspace to prevent cross-workspace leakage.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 */
export function resetWorkspaceQueryCache(queryClient) {
  return queryClient.removeQueries({ queryKey: dynaxisQueryKeys.all });
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {{ organizationId: string, previousOrganizationId?: string | null }} scope
 */
export async function onWorkspaceContextChanged(queryClient, scope) {
  resetWorkspaceQueryCache(queryClient);
  if (scope.organizationId) {
    await invalidateWorkspaceQueries(queryClient, scope.organizationId);
  }
  if (scope.previousOrganizationId && scope.previousOrganizationId !== scope.organizationId) {
    await queryClient.cancelQueries({
      queryKey: dynaxisQueryKeys.workspace(scope.previousOrganizationId),
    });
  }
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {{ organizationId: string, projectId: string | null, previousProjectId?: string | null }} scope
 */
export async function onProjectContextChanged(queryClient, scope) {
  if (scope.previousProjectId && scope.previousProjectId !== scope.projectId) {
    await queryClient.cancelQueries({
      queryKey: [
        ...dynaxisQueryKeys.workspace(scope.organizationId),
        'project',
        String(scope.previousProjectId),
      ],
    });
  }
  if (scope.projectId) {
    await invalidateProjectQueries(queryClient, scope.organizationId, scope.projectId);
  }
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {unknown} error
 * @param {{ organizationId?: string | null }} [scope]
 */
export async function invalidateFromPlatformError(queryClient, error, scope = {}) {
  const { normalizePlatformClientError } = await import('./errors.js');
  const normalized = normalizePlatformClientError(error);
  if (normalized.shouldInvalidateSession) {
    resetWorkspaceQueryCache(queryClient);
    return;
  }
  if (normalized.shouldInvalidateWorkspace && scope.organizationId) {
    await invalidateWorkspaceQueries(queryClient, scope.organizationId);
  }
}
