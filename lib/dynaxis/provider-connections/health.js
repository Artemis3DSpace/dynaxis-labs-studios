/**
 * ProviderConnection health surface (WP-7D-06).
 *
 * Classifies a persisted connection row into a small, safe UI vocabulary and
 * projects it through an allowlist. Classification reads server-only fields
 * (`secretStatus`, `rotationInProgress`) but never emits them: the browser
 * receives a single `health` label plus already-public metadata.
 *
 * WP-7D-02 forbids returning `secretRef`, `keyRef`, envelope metadata, or
 * key-management status to browsers, so this module deliberately does not
 * extend `toPublicProviderConnection` with any of those fields — it adds only
 * derived, non-reversible labels.
 */

import 'server-only';
import { ALLOW } from '../auth/policy.js';
import { authorizeProviderConnection } from './policy.js';
import { toPublicProviderConnection } from './redaction.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';

export const PROVIDER_CONNECTION_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  PENDING: 'pending',
  DISABLED: 'disabled',
  ROTATION_REQUIRED: 'rotation_required',
  ROTATION_DUE_SOON: 'rotation_due_soon',
  REVOKED: 'revoked',
  DELETED: 'deleted',
  SECRET_MISSING: 'secret_missing',
  SECRET_CORRUPTED: 'secret_corrupted',
  SECRET_UNAVAILABLE: 'secret_unavailable',
  EXPIRED: 'expired',
  PROVIDER_ERROR: 'provider_error',
  UNKNOWN: 'unknown',
});

export const PROVIDER_CONNECTION_HEALTH_VALUES = Object.freeze(
  Object.values(PROVIDER_CONNECTION_HEALTH)
);

/** Health states that must block provider dispatch. */
export const PROVIDER_CONNECTION_UNUSABLE_HEALTH = Object.freeze([
  PROVIDER_CONNECTION_HEALTH.PENDING,
  PROVIDER_CONNECTION_HEALTH.DISABLED,
  PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED,
  PROVIDER_CONNECTION_HEALTH.REVOKED,
  PROVIDER_CONNECTION_HEALTH.DELETED,
  PROVIDER_CONNECTION_HEALTH.SECRET_MISSING,
  PROVIDER_CONNECTION_HEALTH.SECRET_CORRUPTED,
  PROVIDER_CONNECTION_HEALTH.SECRET_UNAVAILABLE,
  PROVIDER_CONNECTION_HEALTH.EXPIRED,
  PROVIDER_CONNECTION_HEALTH.PROVIDER_ERROR,
  PROVIDER_CONNECTION_HEALTH.UNKNOWN,
]);

/** Default lead time before `rotationRequiredAt` that surfaces as "due soon". */
export const DEFAULT_ROTATION_DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Classifies a persisted row. Ordered most-severe first so a connection that
 * is both deleted and secret-missing reports the terminal state.
 *
 * Mirrors `ProviderConnectionService.assertUsable` precedence so the label a
 * user sees matches the error dispatch would actually raise.
 */
export function classifyConnectionHealth(
  connection,
  { at = new Date(), rotationDueSoonMs = DEFAULT_ROTATION_DUE_SOON_MS } = {}
) {
  if (!connection) {
    return PROVIDER_CONNECTION_HEALTH.UNKNOWN;
  }

  if (connection.deletedAt || connection.status === 'deleted') {
    return PROVIDER_CONNECTION_HEALTH.DELETED;
  }
  if (connection.revokedAt || connection.status === 'revoked') {
    return PROVIDER_CONNECTION_HEALTH.REVOKED;
  }

  // Secret-layer faults outrank lifecycle labels: they need operator action
  // even when the connection is nominally active.
  if (connection.secretStatus === 'corrupted') {
    return PROVIDER_CONNECTION_HEALTH.SECRET_CORRUPTED;
  }
  if (connection.secretStatus === 'missing') {
    return PROVIDER_CONNECTION_HEALTH.SECRET_MISSING;
  }

  if (
    connection.status === 'rotation_required' ||
    connection.secretStatus === 'rotation_required' ||
    connection.rotationInProgress === true
  ) {
    return PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED;
  }

  const now = asDate(at) || new Date();
  const rotationRequiredAt = asDate(connection.rotationRequiredAt);
  if (rotationRequiredAt && rotationRequiredAt <= now) {
    return PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED;
  }

  const expiresAt = asDate(connection.expiresAt);
  if (expiresAt && expiresAt <= now) {
    return PROVIDER_CONNECTION_HEALTH.EXPIRED;
  }

  if (connection.status === 'provider_error') {
    return PROVIDER_CONNECTION_HEALTH.PROVIDER_ERROR;
  }
  if (connection.status === 'disabled') {
    return PROVIDER_CONNECTION_HEALTH.DISABLED;
  }
  if (connection.status === 'pending_verification') {
    return PROVIDER_CONNECTION_HEALTH.PENDING;
  }

  if (connection.status !== 'active') {
    return PROVIDER_CONNECTION_HEALTH.UNKNOWN;
  }

  if (rotationRequiredAt && rotationRequiredAt.getTime() - now.getTime() <= rotationDueSoonMs) {
    return PROVIDER_CONNECTION_HEALTH.ROTATION_DUE_SOON;
  }

  return PROVIDER_CONNECTION_HEALTH.HEALTHY;
}

export function isUsableHealth(health) {
  return !PROVIDER_CONNECTION_UNUSABLE_HEALTH.includes(health);
}

/**
 * Browser-safe health projection.
 *
 * Built by *composing* the WP-7D-04 public projection (already an allowlist)
 * with derived labels only. No server-only field is added, so a future column
 * cannot leak through this surface either.
 */
export function toPublicConnectionHealth(connection, opts = {}) {
  const publicConnection = toPublicProviderConnection(connection);
  if (!publicConnection) {
    return null;
  }
  const health = classifyConnectionHealth(connection, opts);
  return Object.freeze({
    ...publicConnection,
    health,
    usable: isUsableHealth(health),
  });
}

function canRead(context, connection) {
  return (
    authorizeProviderConnection({
      permission: 'provider_connection.read',
      principal: context?.principal || null,
      workspace: context?.workspace || null,
      connection,
    }).reason === ALLOW
  );
}

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Lists health for connections the caller may read.
 *
 * Rows the caller cannot read are filtered out rather than rejected, so a
 * foreign `organizationId` yields an empty list instead of confirming that
 * connections exist.
 */
export async function listConnectionHealth(
  context,
  { service, ownerType = 'workspace', organizationId = null, ownerUserId = null, at = new Date() } = {}
) {
  if (!service) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A ProviderConnectionService is required'
    );
  }

  const rows =
    ownerType === 'workspace'
      ? await service.repository.listConnectionsForWorkspace(
          textOrNull(organizationId || context?.workspace?.organizationId)
        )
      : await service.repository.listConnectionsForUser(
          textOrNull(ownerUserId || context?.principal?.userId)
        );

  return (rows || [])
    .filter((row) => canRead(context, row))
    .map((row) => toPublicConnectionHealth(row, { at }));
}

/**
 * Health for a single connection. Delegates the read authorization decision to
 * the same policy the service uses, and returns a redacted projection.
 */
export async function getConnectionHealth(
  context,
  { service, connectionId, at = new Date() } = {}
) {
  if (!service) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A ProviderConnectionService is required'
    );
  }
  const id = textOrNull(connectionId);
  if (!id) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      400,
      'connectionId is required'
    );
  }

  // WP-7D-07: "missing" and "not yours" are deliberately indistinguishable on
  // this browser-facing surface. Returning FORBIDDEN for an existing foreign
  // connection but NOT_FOUND for a nonexistent id was an enumeration oracle:
  // a caller holding a guessed id could learn whether it exists. Ownership is
  // still fully enforced — this only removes the distinction in the response.
  //
  // The internal `service.get` keeps its precise FORBIDDEN / OWNER_MISMATCH
  // codes: server-side callers and audit records benefit from the exact
  // reason, and that path is not reachable by a browser.
  const row = await service.repository.findConnectionById(id);
  if (!row || !canRead(context, row)) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
      404,
      'ProviderConnection not found'
    );
  }
  return toPublicConnectionHealth(row, { at });
}
