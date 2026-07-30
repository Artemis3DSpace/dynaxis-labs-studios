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

function textOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

/**
 * Resolve the active Better Auth organization id from a session payload.
 * @param {Record<string, unknown> | null | undefined} sessionPayload
 */
export function resolveSessionOrganizationId(sessionPayload) {
  if (!sessionPayload) return null;
  const session = /** @type {Record<string, unknown>} */ (sessionPayload.session || sessionPayload);
  return textOrNull(
    session.activeOrganizationId ||
      /** @type {{ id?: string }} */ (session.activeOrganization)?.id
  );
}

/**
 * Resolve the authenticated user id from a session payload.
 * @param {Record<string, unknown> | null | undefined} sessionPayload
 */
export function resolveSessionUserId(sessionPayload) {
  if (!sessionPayload) return null;
  const session = /** @type {Record<string, unknown>} */ (sessionPayload.session || sessionPayload);
  const user = /** @type {{ id?: string } | undefined} */ (sessionPayload.user || session.user);
  return textOrNull(user?.id || session.userId);
}

/**
 * @param {Record<string, unknown> | null | undefined} sessionPayload
 */
export function projectDynaxisSessionContext(sessionPayload) {
  const organizationId = resolveSessionOrganizationId(sessionPayload);
  const userId = resolveSessionUserId(sessionPayload);
  if (!organizationId && !userId) {
    return { organizationId: null, userId: null, hasSession: false };
  }
  return {
    organizationId,
    userId,
    hasSession: Boolean(userId),
  };
}

/**
 * Fetch the current Better Auth session. Server session is the workspace authority.
 * @param {typeof dynaxisAuthClient} [authClient]
 */
export async function fetchDynaxisAuthSession(authClient = dynaxisAuthClient) {
  if (typeof authClient?.getSession === 'function') {
    const result = await authClient.getSession();
    return result?.data ?? result ?? null;
  }

  const res = await fetch(`${DYNAXIS_AUTH_BASE_PATH}/get-session`, {
    credentials: 'include',
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json().catch(() => null);
  return data?.session || data?.user ? data : null;
}

/**
 * List organizations visible to the signed-in user.
 * @param {typeof dynaxisAuthClient} [authClient]
 */
export async function listDynaxisOrganizations(authClient = dynaxisAuthClient) {
  if (typeof authClient?.organization?.list === 'function') {
    const result = await authClient.organization.list();
    return result?.data ?? result ?? [];
  }
  const res = await fetch(`${DYNAXIS_AUTH_BASE_PATH}/organization/list`, {
    credentials: 'include',
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : data?.data ?? [];
}

/**
 * Switch the active Better Auth organization for the current session.
 * @param {string} organizationId
 * @param {typeof dynaxisAuthClient} [authClient]
 */
export async function switchDynaxisActiveOrganization(organizationId, authClient = dynaxisAuthClient) {
  const nextOrganizationId = textOrNull(organizationId);
  if (!nextOrganizationId) {
    throw new Error('organizationId is required to switch Dynaxis workspace');
  }
  if (typeof authClient?.organization?.setActive !== 'function') {
    throw new Error('Better Auth organization client is unavailable');
  }
  const result = await authClient.organization.setActive({ organizationId: nextOrganizationId });
  if (result?.error) {
    throw result.error;
  }
  return result?.data ?? result ?? null;
}
