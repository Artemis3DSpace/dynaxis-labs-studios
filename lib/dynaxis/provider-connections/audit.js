/**
 * ProviderConnection runtime audit boundary (WP-7D-04).
 *
 * The repository has no general audit/event infrastructure yet, so this module
 * defines the ProviderConnection audit contract and a pluggable sink. The
 * default sink is a bounded in-memory ring buffer: audit is observable and
 * testable without inventing a persistence layer that belongs to a future
 * package. A deployment (or a later Work Package) supplies a durable sink via
 * `createProviderConnectionAuditor({ sink })`.
 *
 * Every event is scrubbed before it reaches the sink. WP-7D-01/02 forbid raw
 * API keys, bearer tokens, OAuth access/refresh tokens, client secrets,
 * service-account JSON, webhook secrets, decrypted payloads, and envelope
 * ciphertext internals in audit properties.
 */

import 'server-only';

export const PROVIDER_CONNECTION_AUDIT_EVENTS = Object.freeze({
  CREATED: 'provider_connection.created',
  READ: 'provider_connection.read',
  LISTED: 'provider_connection.listed',
  UPDATED: 'provider_connection.updated',
  USE_ATTEMPTED: 'provider_connection.use.attempted',
  USE_SUCCEEDED: 'provider_connection.use.succeeded',
  USE_FAILED: 'provider_connection.use.failed',
  ROTATED: 'provider_connection.rotated',
  REVOKED: 'provider_connection.revoked',
  DELETED: 'provider_connection.deleted',
  SECRET_STATUS_CHANGED: 'provider_connection.secret_status.changed',
  DENIED: 'provider_connection.denied',
});

/**
 * Property names that must never be written to an audit record, regardless of
 * how a caller nests them.
 */
const FORBIDDEN_AUDIT_KEYS = Object.freeze([
  'secret',
  'secretvalue',
  'plaintext',
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'clientsecret',
  'client_secret',
  'serviceaccountjson',
  'service_account_json',
  'webhooksecret',
  'webhook_secret',
  'authorizationcode',
  'authorization_code',
  'password',
  'credential',
  'encryptedpayload',
  'encrypted_payload',
  'ciphertext',
  'authtag',
  'auth_tag',
  'iv',
  'keymaterial',
  'key_material',
  'aad',
]);

/** Safe technical metadata explicitly permitted by the spec. */
const ALLOWED_TECHNICAL_KEYS = Object.freeze([
  'connectionId',
  'providerId',
  'ownerType',
  'ownerUserId',
  'ownerWorkspaceId',
  'credentialKind',
  'credentialFingerprint',
  'status',
  'secretStatus',
  'previousSecretStatus',
  'secretVersion',
  'reasonCode',
  'errorCode',
  'permission',
  'projectId',
  'workspaceId',
  'correlationId',
  'actorUserId',
  'outcome',
  'algorithm',
  'count',
]);

function isForbiddenKey(key) {
  const normalized = String(key || '').toLowerCase().replace(/[^a-z_]/g, '');
  return FORBIDDEN_AUDIT_KEYS.some(
    (forbidden) => normalized === forbidden.replace(/[^a-z_]/g, '')
  );
}

/**
 * Copies only allowlisted, non-forbidden scalar properties. Nested objects are
 * dropped rather than walked, so no structure can smuggle secret material.
 */
export function scrubAuditProperties(properties = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(properties || {})) {
    if (isForbiddenKey(key)) {
      continue;
    }
    if (!ALLOWED_TECHNICAL_KEYS.includes(key)) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'object') {
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export function createMemoryAuditSink({ limit = 500 } = {}) {
  const events = [];
  return {
    async write(event) {
      events.push(event);
      if (events.length > limit) {
        events.splice(0, events.length - limit);
      }
    },
    list() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}

export function createProviderConnectionAuditor({ sink = createMemoryAuditSink() } = {}) {
  return {
    sink,
    /**
     * Records an audit event. Never throws into the caller's control flow:
     * an audit sink failure must not become a covert authorization bypass, so
     * the caller decides how to react via the returned boolean.
     */
    async record(event, properties = {}) {
      const record = Object.freeze({
        event,
        occurredAt: new Date().toISOString(),
        properties: scrubAuditProperties(properties),
      });
      try {
        await sink.write(record);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const providerConnectionAuditor = createProviderConnectionAuditor();
