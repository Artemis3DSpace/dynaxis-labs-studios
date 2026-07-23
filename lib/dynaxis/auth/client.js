/**
 * Browser-safe Better Auth React client for Dynaxis authentication.
 */

import { createAuthClient } from 'better-auth/react';
import { DYNAXIS_AUTH_BASE_PATH } from './options.js';

export const dynaxisAuthClient = createAuthClient({
  basePath: DYNAXIS_AUTH_BASE_PATH,
  plugins: [],
});

export const authClient = dynaxisAuthClient;
