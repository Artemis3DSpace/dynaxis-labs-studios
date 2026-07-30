'use client';

import React from 'react';
import {
  fetchDynaxisAuthSession,
  dynaxisAuthClient,
} from '../../../../lib/dynaxis/auth/client.js';
import { createWorkspaceSessionController } from './workspace-controller.js';
import { getDynaxisQueryClient } from '../query/client.js';

const WorkspaceSessionContext = React.createContext(null);

/**
 * @param {{ children: React.ReactNode, authClient?: typeof dynaxisAuthClient, queryClient?: import('@tanstack/react-query').QueryClient }} props
 */
export function DynaxisSessionProvider({
  children,
  authClient = dynaxisAuthClient,
  queryClient = getDynaxisQueryClient(),
}) {
  const controller = React.useMemo(
    () =>
      createWorkspaceSessionController({
        authClient,
        queryClient,
        fetchSession: (client) => fetchDynaxisAuthSession(client || authClient),
      }),
    [authClient, queryClient]
  );

  const [state, setState] = React.useState(() => controller.readState());

  React.useEffect(() => {
    let active = true;
    fetchDynaxisAuthSession(authClient)
      .then((session) => {
        if (!active) return;
        return controller.hydrateFromSession(session);
      })
      .catch(() => controller.clearSessionContext())
      .finally(() => {
        if (active) setState(controller.readState());
      });
    return () => {
      active = false;
    };
  }, [authClient, controller]);

  React.useEffect(() => controller.subscribe(setState), [controller]);

  const value = React.useMemo(
    () => ({
      ...state,
      controller,
      switchWorkspace: (organizationId) => controller.switchWorkspace(organizationId),
      switchProject: (projectId, scope) => controller.switchProject(projectId, scope),
      refreshSession: async () => {
        const session = await fetchDynaxisAuthSession(authClient);
        await controller.hydrateFromSession(session);
        return controller.readState();
      },
    }),
    [controller, state]
  );

  return (
    <WorkspaceSessionContext.Provider value={value}>{children}</WorkspaceSessionContext.Provider>
  );
}

export function useDynaxisSessionWorkspace() {
  const ctx = React.useContext(WorkspaceSessionContext);
  if (!ctx) {
    throw new Error('useDynaxisSessionWorkspace must be used within DynaxisSessionProvider');
  }
  return ctx;
}

export function useDynaxisActiveProject() {
  const { projectId, organizationId } = useDynaxisSessionWorkspace();
  return { projectId, organizationId };
}

export function useSwitchDynaxisWorkspace() {
  const { switchWorkspace } = useDynaxisSessionWorkspace();
  return switchWorkspace;
}

export function useSwitchDynaxisProject() {
  const { switchProject } = useDynaxisSessionWorkspace();
  return switchProject;
}
