/**
 * Session-scoped ProviderConnection client API (WP-7D-06).
 *
 * The browser only ever sees the server's allowlist projections. This module
 * additionally asserts that on the way in: if a response ever carried a
 * forbidden field it would be a server regression, and failing loudly here is
 * safer than rendering it.
 *
 * Rotation submits the raw credential once and never stores it client-side.
 */

import { sessionPlatformFetch } from '../../../../lib/dynaxis/client/platform-api.js';

const BASE = '/api/dynaxis/provider-connections';

/**
 * Fields that must never appear in a ProviderConnection API response.
 * Mirrors the server-side forbidden list.
 */
export const FORBIDDEN_CLIENT_FIELDS = Object.freeze([
  'secretRef',
  'secret_ref',
  'keyRef',
  'key_ref',
  'secretVersion',
  'secret_version',
  'secretStatus',
  'secret_status',
  'envelopeId',
  'envelopeCreatedAt',
  'envelope_created_at',
  'encryptedPayload',
  'encrypted_payload',
  'ciphertext',
  'authTag',
  'auth_tag',
  'iv',
  'aad',
  'aadOwnerType',
  'aadOwnerId',
  'aadProviderId',
  'aadCredentialKind',
  'aadSecretVersion',
  'plaintext',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'serviceAccountJson',
  'webhookSecret',
]);

export class ProviderConnectionResponseError extends Error {
  constructor(field) {
    super('ProviderConnection response contained a forbidden field');
    this.name = 'ProviderConnectionResponseError';
    this.code = 'DYNAXIS_PROVIDER_CONNECTION_FORBIDDEN_FIELD';
    this.field = field;
  }
}

/**
 * Fails closed if the server ever returns a forbidden field. Deliberately not
 * a silent strip: silently dropping it would hide a server-side leak.
 */
export function assertNoForbiddenFields(value) {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoForbiddenFields(entry));
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new ProviderConnectionResponseError(field);
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      assertNoForbiddenFields(nested);
    }
  }
  return value;
}

export async function fetchConnectionHealth({ ownerType = 'workspace' } = {}) {
  const data = await sessionPlatformFetch(`${BASE}?ownerType=${encodeURIComponent(ownerType)}`);
  const connections = data?.connections || [];
  return assertNoForbiddenFields(connections);
}

export async function fetchConnectionDetail(connectionId) {
  const data = await sessionPlatformFetch(`${BASE}/${encodeURIComponent(connectionId)}`);
  return assertNoForbiddenFields(data?.connection || null);
}

export async function fetchConnectionAudit(connectionId, { event = null, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (event) params.set('event', event);
  if (limit) params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await sessionPlatformFetch(
    `${BASE}/${encodeURIComponent(connectionId)}/audit${suffix}`
  );
  return assertNoForbiddenFields(data?.events || []);
}

/**
 * Submits a replacement credential. The value is passed straight through and
 * never persisted in client state by this helper.
 */
export async function rotateConnectionSecret(connectionId, secret) {
  const data = await sessionPlatformFetch(
    `${BASE}/${encodeURIComponent(connectionId)}/rotate`,
    { method: 'POST', body: JSON.stringify({ secret }) }
  );
  return assertNoForbiddenFields(data?.connection || null);
}

export async function revokeConnection(connectionId) {
  const data = await sessionPlatformFetch(
    `${BASE}/${encodeURIComponent(connectionId)}/revoke`,
    { method: 'POST' }
  );
  return assertNoForbiddenFields(data?.connection || null);
}

export async function deleteConnection(connectionId) {
  const data = await sessionPlatformFetch(`${BASE}/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
  });
  return assertNoForbiddenFields(data?.connection || null);
}
