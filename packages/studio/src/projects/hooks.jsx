'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dynaxisQueryKeys } from '../query/keys.js';
import { useDynaxisSessionWorkspace } from '../session/hooks.jsx';
import {
  fetchWorkspaceProjectDetail,
  fetchWorkspaceProjects,
  sessionArchiveProject,
  sessionCreateProject,
  sessionUpdateProject,
} from './api.js';
import { invalidateProjectMutationQueries } from './invalidation.js';

/**
 * @param {{ includeArchived?: boolean, ensureDefault?: boolean, enabled?: boolean }} [opts]
 */
export function useProjectsList(opts = {}) {
  const { organizationId } = useDynaxisSessionWorkspace();
  const filters = {
    includeArchived: opts.includeArchived === true,
    ensureDefault: opts.ensureDefault !== false,
  };
  const enabled = opts.enabled !== false && Boolean(organizationId);

  return useQuery({
    queryKey: dynaxisQueryKeys.projects.list(organizationId, filters),
    queryFn: () => fetchWorkspaceProjects(organizationId, filters),
    enabled,
  });
}

/**
 * @param {string | null | undefined} projectId
 * @param {{ enabled?: boolean }} [opts]
 */
export function useProjectDetail(projectId, opts = {}) {
  const { organizationId } = useDynaxisSessionWorkspace();
  const enabled = opts.enabled !== false && Boolean(organizationId && projectId);

  return useQuery({
    queryKey: dynaxisQueryKeys.projects.detail(organizationId, projectId),
    queryFn: () => fetchWorkspaceProjectDetail(organizationId, projectId),
    enabled,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  const { organizationId } = useDynaxisSessionWorkspace();

  return useMutation({
    mutationFn: (body) => {
      if (!organizationId) {
        throw new Error('organizationId is required to create a project');
      }
      return sessionCreateProject(body);
    },
    onSuccess: async (project) => {
      if (!organizationId) return;
      await invalidateProjectMutationQueries(queryClient, organizationId, project?.id);
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  const { organizationId } = useDynaxisSessionWorkspace();

  return useMutation({
    mutationFn: ({ projectId, body }) => {
      if (!organizationId || !projectId) {
        throw new Error('organizationId and projectId are required to update a project');
      }
      return sessionUpdateProject(projectId, body);
    },
    onSuccess: async (project) => {
      if (!organizationId) return;
      await invalidateProjectMutationQueries(queryClient, organizationId, project?.id);
    },
  });
}

export function useArchiveProjectMutation() {
  const queryClient = useQueryClient();
  const { organizationId, projectId: activeProjectId, switchProject } = useDynaxisSessionWorkspace();

  return useMutation({
    mutationFn: (projectId) => {
      if (!organizationId || !projectId) {
        throw new Error('organizationId and projectId are required to archive a project');
      }
      return sessionArchiveProject(projectId);
    },
    onSuccess: async (_project, archivedProjectId) => {
      if (!organizationId) return;
      await invalidateProjectMutationQueries(queryClient, organizationId, archivedProjectId);
      if (activeProjectId && archivedProjectId === activeProjectId) {
        await switchProject(null);
      }
    },
  });
}

/**
 * @param {{ autoSelect?: boolean }} [opts]
 */
export function useEnsureDefaultProject(opts = {}) {
  const { organizationId, projectId, switchProject } = useDynaxisSessionWorkspace();
  const listQuery = useProjectsList({ ensureDefault: true, enabled: Boolean(organizationId) });

  return {
    ...listQuery,
    organizationId,
    projectId,
    switchProject,
    autoSelect: opts.autoSelect !== false,
  };
}
