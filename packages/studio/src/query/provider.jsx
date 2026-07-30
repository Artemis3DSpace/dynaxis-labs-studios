'use client';

import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createDynaxisQueryClient } from './client.js';
import { onProjectContextChanged, onWorkspaceContextChanged } from './invalidation.js';

/**
 * @param {{ children: React.ReactNode, client?: import('@tanstack/react-query').QueryClient, organizationId?: string | null, projectId?: string | null }} props
 */
export function DynaxisQueryProvider({
  children,
  client,
  organizationId = null,
  projectId = null,
}) {
  const queryClient = React.useMemo(() => client || createDynaxisQueryClient(), [client]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let previousOrganizationId =
      window.__dynaxisOrganizationId != null ? String(window.__dynaxisOrganizationId) : null;
    let previousProjectId =
      window.__dynaxisProjectId != null ? String(window.__dynaxisProjectId) : null;

    const onWorkspace = async (event) => {
      const nextOrganizationId = event.detail?.organizationId
        ? String(event.detail.organizationId)
        : null;
      if (!nextOrganizationId || nextOrganizationId === previousOrganizationId) return;
      await onWorkspaceContextChanged(queryClient, {
        organizationId: nextOrganizationId,
        previousOrganizationId,
      });
      previousOrganizationId = nextOrganizationId;
    };

    const onProject = async (event) => {
      const nextProjectId = event.detail?.projectId ? String(event.detail.projectId) : null;
      const activeOrganizationId =
        event.detail?.organizationId != null
          ? String(event.detail.organizationId)
          : previousOrganizationId;
      if (!activeOrganizationId) return;
      if (nextProjectId === previousProjectId) return;
      await onProjectContextChanged(queryClient, {
        organizationId: activeOrganizationId,
        projectId: nextProjectId,
        previousProjectId,
      });
      previousProjectId = nextProjectId;
    };

    window.addEventListener('dynaxis:workspace-context', onWorkspace);
    window.addEventListener('dynaxis:project-context', onProject);

    return () => {
      window.removeEventListener('dynaxis:workspace-context', onWorkspace);
      window.removeEventListener('dynaxis:project-context', onProject);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!organizationId) return;
    onWorkspaceContextChanged(queryClient, {
      organizationId: String(organizationId),
      previousOrganizationId: null,
    }).catch(() => {});
  }, [organizationId, queryClient]);

  useEffect(() => {
    if (!organizationId || !projectId) return;
    onProjectContextChanged(queryClient, {
      organizationId: String(organizationId),
      projectId: String(projectId),
      previousProjectId: null,
    }).catch(() => {});
  }, [organizationId, projectId, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
