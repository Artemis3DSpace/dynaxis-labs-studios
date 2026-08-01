/**
 * ProviderConnection audit visibility (WP-7D-06).
 *
 * Read surface over the WP-7D-04 audit sink. Two independent layers keep
 * secrets out:
 *
 *   1. `scrubAuditProperties` already ran on write, so stored events are
 *      allowlisted;
 *   2. this module re-projects on read through its own allowlist, so a sink
 *      that was populated by other means (a test double, a future durable
 *      sink, a migration) still cannot surface forbidden material.
 *
 * Durable audit persistence is explicitly NOT implemented here — it would
 * require schema, which WP-7D-06 does not own.
 */

import 'server-only';
import { ALLOW } from '../auth/policy.js';
import { authorizeProviderConnection } from './policy.js';
import { scrubAuditProperties } from './audit.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';

/** Top-level audit record fields safe to return. */
const PUBLIC_AUDIT_FIELDS = Object.freeze(['event', 'occurredAt']);

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Re-projects a stored audit record through an allowlist.
 * Properties are re-scrubbed rather than trusted.
 */
export function toPublicAuditEvent(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const projection = {};
  for (const field of PUBLIC_AUDIT_FIELDS) {
    if (record[field] !== undefined && typeof record[field] !== 'object') {
      projection[field] = record[field];
    }
  }
  projection.properties = Object.freeze(scrubAuditProperties(record.properties || {}));
  return Object.freeze(projection);
}

/**
 * Reads scrubbed audit events for a connection.
 *
 * Requires `provider_connection.audit.read` against the *persisted* connection
 * row, so ownership is authoritative rather than caller-supplied.
 */
export async function readProviderConnectionAudit(
  context,
  { service, connectionId, event = null, limit = 100 } = {}
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

  const connection = await service.repository.findConnectionById(id);
  if (!connection) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
      404,
      'ProviderConnection not found'
    );
  }

  const decision = authorizeProviderConnection({
    permission: 'provider_connection.audit.read',
    principal: context?.principal || null,
    workspace: context?.workspace || null,
    connection,
  });
  if (decision.reason !== ALLOW) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'ProviderConnection audit access denied',
      { decision }
    );
  }

  const sink = service.auditor?.sink;
  if (!sink || typeof sink.list !== 'function') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.AUDIT_UNAVAILABLE,
      503,
      'ProviderConnection audit is unavailable'
    );
  }

  const wanted = textOrNull(event);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;

  return sink
    .list()
    .filter((record) => record?.properties?.connectionId === id)
    .filter((record) => (wanted ? record.event === wanted : true))
    .slice(-safeLimit)
    .map((record) => toPublicAuditEvent(record))
    .filter(Boolean);
}
