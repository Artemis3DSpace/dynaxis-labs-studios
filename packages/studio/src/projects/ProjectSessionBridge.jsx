'use client';

import React from 'react';
import { publishProjectContext } from '../../../../lib/dynaxis/client/project-context.js';
import { useDynaxisSessionWorkspace } from '../session/hooks.jsx';
import { useEnsureDefaultProject } from './hooks.jsx';
import { filterProjectsForWorkspace, resolvePreferredProject } from './selection.js';

/**
 * Minimal Studio project/session bridge:
 * - loads workspace-scoped project list via TanStack Query
 * - bootstraps default/active project into WP-7C-19 session context
 * - clears stale selection when workspace changes
 *
 * @param {{
 *   children?: React.ReactNode,
 *   showPicker?: boolean,
 *   autoSelect?: boolean,
 *   className?: string,
 * }} props
 */
export function ProjectSessionBridge({
  children,
  showPicker = false,
  autoSelect = true,
  className,
}) {
  const { organizationId, projectId, switchProject, hasSession } = useDynaxisSessionWorkspace();
  const { data: projects = [], isLoading, isError } = useEnsureDefaultProject({ autoSelect });
  const previousOrganizationIdRef = React.useRef(organizationId);

  const workspaceProjects = React.useMemo(
    () => filterProjectsForWorkspace(projects, organizationId),
    [projects, organizationId]
  );

  React.useEffect(() => {
    if (previousOrganizationIdRef.current !== organizationId) {
      previousOrganizationIdRef.current = organizationId;
      if (!organizationId && projectId) {
        switchProject(null).catch(() => {});
      }
    }
  }, [organizationId, projectId, switchProject]);

  React.useEffect(() => {
    if (!autoSelect || !organizationId || !hasSession || isLoading || isError) {
      return;
    }
    if (projectId) {
      const active = workspaceProjects.find((project) => project.id === projectId);
      if (active) {
        publishProjectContext({ organizationId, projectId, project: active });
      }
      return;
    }
    const preferred = resolvePreferredProject(workspaceProjects);
    if (!preferred?.id) {
      return;
    }
    switchProject(preferred.id, { organizationId })
      .then(() => {
        publishProjectContext({ organizationId, projectId: preferred.id, project: preferred });
      })
      .catch(() => {});
  }, [
    autoSelect,
    organizationId,
    hasSession,
    isLoading,
    isError,
    projectId,
    workspaceProjects,
    switchProject,
  ]);

  const handleSelect = React.useCallback(
    async (event) => {
      const nextProjectId = event.target.value || null;
      if (!organizationId) return;
      await switchProject(nextProjectId, { organizationId });
      const project = workspaceProjects.find((item) => item.id === nextProjectId) || null;
      publishProjectContext({ organizationId, projectId: nextProjectId, project });
    },
    [organizationId, switchProject, workspaceProjects]
  );

  return (
    <>
      {showPicker && organizationId && workspaceProjects.length > 0 ? (
        <label className={className || 'dynaxis-project-session-bridge'}>
          <span className="sr-only">Active project</span>
          <select value={projectId || ''} onChange={handleSelect} disabled={isLoading}>
            {workspaceProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {children}
    </>
  );
}
