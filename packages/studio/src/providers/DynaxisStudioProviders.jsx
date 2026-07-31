'use client';

import React from 'react';
import { DynaxisQueryProvider } from '../query/provider.jsx';
import { DynaxisSessionProvider } from '../session/hooks.jsx';
import { ProjectSessionBridge } from '../projects/ProjectSessionBridge.jsx';

/**
 * @param {{
 *   children: React.ReactNode,
 *   showProjectPicker?: boolean,
 *   autoSelectProject?: boolean,
 *   queryClient?: import('@tanstack/react-query').QueryClient,
 * }} props
 */
export function DynaxisStudioProviders({
  children,
  showProjectPicker = false,
  autoSelectProject = true,
  queryClient,
}) {
  return (
    <DynaxisQueryProvider client={queryClient}>
      <DynaxisSessionProvider queryClient={queryClient}>
        <ProjectSessionBridge showPicker={showProjectPicker} autoSelect={autoSelectProject}>
          {children}
        </ProjectSessionBridge>
      </DynaxisSessionProvider>
    </DynaxisQueryProvider>
  );
}
