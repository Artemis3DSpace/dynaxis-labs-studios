/**
 * Provider Resolver (WP-7D-05).
 *
 * Bridges an authorized AuthContext to a provider adapter call by selecting a
 * ProviderConnection and materializing its credential through the WP-7D-04
 * boundary. This module lives on the ProviderConnection side of the boundary
 * on purpose: `lib/dynaxis/providers/**` stays pure adapter code that receives
 * credential material as a call argument and never reaches key management or
 * envelope internals.
 *
 * Selection order (WP-7D-05 deliverable):
 *   1. an explicit `connectionId` supplied by the caller;
 *   2. otherwise the owner's default connection for that provider
 *      (`defaultForWorkspace` / `defaultForUser`, active, not tombstoned).
 *
 * Legacy `x-api-key` is deliberately not part of this path. It remains a
 * server compatibility principal and is rejected before any connection is
 * loaded, so it can never acquire ProviderConnection authority.
 */

import 'server-only';
import { ALLOW } from '../auth/policy.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';
import { PROVIDER_CONNECTION_AUDIT_EVENTS } from './audit.js';
import { useProviderCredential } from './materialization.js';
import { authorizeProviderConnection, OWNER_MISMATCH } from './policy.js';

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Legacy `x-api-key` principals (and any non-human principal) are refused
 * before a connection is even loaded. The WP-7D-04 policy would deny them
 * anyway; this is an explicit, auditable early gate so the intent cannot be
 * lost in a refactor.
 */
export function assertProviderConnectionCapablePrincipal(context) {
  const type = context?.principal?.type || context?.subject?.type || null;
  if (type === 'legacy') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'Legacy x-api-key compatibility does not grant ProviderConnection authority'
    );
  }
  if (type !== 'human') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'Only human principals may use ProviderConnections'
    );
  }
  return true;
}

/**
 * Whether the caller may read this connection row at all.
 *
 * Selection returns persisted rows that carry `secretRef` and `keyRef`, so it
 * must gate on `provider_connection.read` rather than deferring entirely to
 * materialization. Deferring would let any authenticated user read another
 * Workspace's connection metadata by passing a foreign `organizationId` or
 * `connectionId`, even though dispatch would later fail closed.
 */
function canReadConnection(context, row) {
  return (
    authorizeProviderConnection({
      permission: 'provider_connection.read',
      principal: context?.principal || null,
      workspace: context?.workspace || null,
      connection: row,
    }).reason === ALLOW
  );
}

function assertReadableConnection(context, row) {
  const decision = authorizeProviderConnection({
    permission: 'provider_connection.read',
    principal: context?.principal || null,
    workspace: context?.workspace || null,
    connection: row,
  });
  if (decision.reason !== ALLOW) {
    throw providerConnectionError(
      decision.reason === OWNER_MISMATCH
        ? PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
        : PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'ProviderConnection access denied',
      { decision }
    );
  }
  return true;
}

function isSelectableDefault(row, providerId, ownerType) {
  if (textOrNull(row.providerId) !== providerId) return false;
  if (row.deletedAt || row.revokedAt) return false;
  if (row.status !== 'active') return false;
  return ownerType === 'workspace'
    ? row.defaultForWorkspace === true
    : row.defaultForUser === true;
}

/**
 * Selects the ProviderConnection to use, without unwrapping anything.
 *
 * Returns the persisted row (server-only), which carries `secretRef` and
 * `keyRef` — so this gates on `provider_connection.read` before returning
 * anything. Lifecycle gating and `provider_connection.use` are still enforced
 * later by `service.resolveForUse` during materialization; the read check here
 * exists so selection cannot be used on its own to enumerate or disclose
 * another owner's connection metadata.
 */
export async function selectProviderConnection(
  context,
  { service, providerId, connectionId = null, ownerType = 'workspace', organizationId = null, ownerUserId = null } = {}
) {
  assertProviderConnectionCapablePrincipal(context);

  const provider = textOrNull(providerId);
  if (!provider) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      400,
      'providerId is required'
    );
  }
  if (!service) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A ProviderConnectionService is required'
    );
  }

  const explicitId = textOrNull(connectionId);
  if (explicitId) {
    const row = await service.repository.findConnectionById(explicitId);
    if (!row) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
        404,
        'ProviderConnection not found'
      );
    }
    assertReadableConnection(context, row);
    assertProviderMatches(row, provider);
    return row;
  }

  const rows =
    ownerType === 'workspace'
      ? await service.repository.listConnectionsForWorkspace(
          textOrNull(organizationId || context?.workspace?.organizationId)
        )
      : await service.repository.listConnectionsForUser(
          textOrNull(ownerUserId || context?.principal?.userId)
        );

  // Filtered rather than asserted: an unreadable row must be invisible to
  // default selection, so a foreign `organizationId` yields "not found"
  // instead of confirming that a connection exists.
  const candidate = (rows || [])
    .filter((row) => canReadConnection(context, row))
    .find((row) => isSelectableDefault(row, provider, ownerType));
  if (!candidate) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
      404,
      `No active default ProviderConnection for provider ${provider}`
    );
  }
  return candidate;
}

/**
 * Fails closed when the resolved connection is for a different provider than
 * the dispatch expects, so a credential can never cross provider boundaries.
 */
export function assertProviderMatches(connection, expectedProviderId) {
  const actual = textOrNull(connection?.providerId);
  const expected = textOrNull(expectedProviderId);
  if (!actual || !expected || actual !== expected) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.UNSUPPORTED_PROVIDER,
      403,
      'ProviderConnection does not belong to the requested provider'
    );
  }
  return true;
}

/**
 * Resolves a ProviderConnection and runs `dispatch` with the materialized
 * credential.
 *
 * `dispatch` receives `{ apiKey, connectionId, providerId, credentialKind,
 * secretVersion }`. `apiKey` is plaintext and is valid only for the duration
 * of the callback — `useProviderCredential` scrubs the reference afterwards.
 * It must not be logged, cached, persisted, put in a Job payload, or returned.
 */
export async function dispatchWithProviderConnection(
  context,
  {
    service,
    providerId,
    connectionId = null,
    ownerType = 'workspace',
    organizationId = null,
    ownerUserId = null,
    projectScoped = false,
    project = null,
    capabilityId = null,
    modelId = null,
    correlationId = null,
  } = {},
  dispatch
) {
  if (typeof dispatch !== 'function') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A dispatch callback is required'
    );
  }

  const selected = await selectProviderConnection(context, {
    service,
    providerId,
    connectionId,
    ownerType,
    organizationId,
    ownerUserId,
  });

  // Authorization, lifecycle gating, capability/model checks, unwrap, and
  // audit all happen inside the WP-7D-04 boundary. The resolver never touches
  // envelope or key-management internals itself.
  return useProviderCredential(
    context,
    {
      service,
      connectionId: selected.id,
      projectScoped,
      project,
      capabilityId,
      modelId,
      correlationId,
    },
    async (credential) => {
      // Re-assert after materialization: the row could not have changed under
      // us, but this keeps provider identity an explicit precondition of the
      // adapter call rather than an assumption.
      assertProviderMatches(credential, providerId);
      return dispatch({
        apiKey: credential.secret,
        connectionId: credential.connectionId,
        providerId: credential.providerId,
        credentialKind: credential.credentialKind,
        secretVersion: credential.secretVersion,
      });
    }
  );
}

export const DYNAXIS_MUAPI_PROVIDER_ID = 'muapi';

/**
 * MuAPI-specific convenience wrapper. Pins `providerId` so a MuAPI dispatch
 * can never be served by another provider's credential.
 */
export async function withMuapiCredential(context, options = {}, dispatch) {
  return dispatchWithProviderConnection(
    context,
    { ...options, providerId: DYNAXIS_MUAPI_PROVIDER_ID },
    dispatch
  );
}

export { PROVIDER_CONNECTION_AUDIT_EVENTS };
