/**
 * Server-only Better Auth runtime boundary.
 */

import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from '../db/client.js';
import { BETTER_AUTH_DRIZZLE_SCHEMA } from './schema.js';
import { createDynaxisAuthOptions } from './options.js';
import { createDynaxisWorkspaceDatabaseHooks } from '../identity/session-workspace.js';
import { createDynaxisWorkspaceOrganizationHooks } from '../identity/workspace-protection.js';
import {
  loadAuthContextFromRequest,
  resolveAuthContextProject,
  requireAuthContextWorkspace,
  requireAuthContextProject,
  checkAuthContextPermission,
  assertAuthContextPermission,
} from './auth-context.js';

let authInstance = null;

export function createDynaxisAuth({ db = getDb(), env = process.env } = {}) {
  const database = drizzleAdapter(db, {
    provider: 'pg',
    schema: BETTER_AUTH_DRIZZLE_SCHEMA,
  });
  return betterAuth(
    createDynaxisAuthOptions({
      database,
      env,
      databaseHooks: createDynaxisWorkspaceDatabaseHooks({ db }),
      organizationHooks: createDynaxisWorkspaceOrganizationHooks({ db }),
    })
  );
}

export function getDynaxisAuth() {
  if (!authInstance) {
    authInstance = createDynaxisAuth();
  }
  return authInstance;
}

export function getDynaxisAuthHandler() {
  return getDynaxisAuth().handler;
}

export async function loadDynaxisAuthContext(request, opts = {}) {
  return loadAuthContextFromRequest(request, {
    ...opts,
    auth: opts.auth || getDynaxisAuth(),
  });
}

export {
  resolveAuthContextProject,
  requireAuthContextWorkspace,
  requireAuthContextProject,
  checkAuthContextPermission,
  assertAuthContextPermission,
};

export function resetDynaxisAuthForTests() {
  authInstance = null;
}
