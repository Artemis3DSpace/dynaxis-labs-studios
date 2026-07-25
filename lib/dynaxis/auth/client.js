/**
 * Browser-safe Better Auth React client for Dynaxis authentication.
 */

import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { DYNAXIS_AUTH_BASE_PATH } from './constants.js';
import { dynaxisWorkspaceAccessControl, dynaxisWorkspaceRoles } from './workspace-access.js';

export const dynaxisAuthClient = createAuthClient({
  basePath: DYNAXIS_AUTH_BASE_PATH,
  plugins: [
    organizationClient({
      ac: dynaxisWorkspaceAccessControl,
      roles: dynaxisWorkspaceRoles,
      teams: {
        enabled: false,
      },
      dynamicAccessControl: {
        enabled: false,
      },
    }),
  ],
});

export const authClient = dynaxisAuthClient;
