/**
 * TanStack Query invalidation for Project catalog mutations.
 */

import { dynaxisQueryKeys } from '../query/keys.js';

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} organizationId
 */
export async function invalidateProjectCatalogQueries(queryClient, organizationId) {
  await queryClient.invalidateQueries({
    queryKey: dynaxisQueryKeys.projects.all(organizationId),
  });
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} organizationId
 * @param {string} projectId
 */
export async function invalidateProjectDetailQuery(queryClient, organizationId, projectId) {
  await queryClient.invalidateQueries({
    queryKey: dynaxisQueryKeys.projects.detail(organizationId, projectId),
  });
}

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} organizationId
 * @param {string} [projectId]
 */
export async function invalidateProjectMutationQueries(queryClient, organizationId, projectId) {
  await invalidateProjectCatalogQueries(queryClient, organizationId);
  if (projectId) {
    await invalidateProjectDetailQuery(queryClient, organizationId, projectId);
  }
}
