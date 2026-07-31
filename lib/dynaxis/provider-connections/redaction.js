/**
 * ProviderConnection browser/API redaction (WP-7D-04).
 *
 * WP-7D-02 browser rules: never return secret material, `secretRef`, `keyRef`,
 * envelope metadata, decrypted payloads, or key-management status to browsers.
 *
 * This module is an allowlist, not a denylist: the public projection copies
 * only fields that are explicitly safe, so a future column added to the
 * connection table cannot leak by default.
 */

/** Fields that must never appear in a browser or public API response. */
export const PROVIDER_CONNECTION_FORBIDDEN_PUBLIC_FIELDS = Object.freeze([
  'secretRef',
  'secret_ref',
  'keyRef',
  'key_ref',
  'secretVersion',
  'secret_version',
  'envelopeCreatedAt',
  'envelope_created_at',
  'encryptedPayload',
  'encrypted_payload',
  'authTag',
  'auth_tag',
  'iv',
  'aadOwnerType',
  'aadOwnerId',
  'aadProviderId',
  'aadCredentialKind',
  'aadSecretVersion',
  'plaintext',
  'secret',
]);

/** Explicit allowlist of browser-safe ProviderConnection metadata. */
const PUBLIC_FIELDS = Object.freeze([
  'id',
  'providerId',
  'ownerType',
  'ownerUserId',
  'ownerWorkspaceId',
  'credentialKind',
  'credentialFingerprint',
  'label',
  'providerDisplayName',
  'providerAccountId',
  'providerAccountLabel',
  'providerAccountAvatarUrl',
  'providerRegion',
  'metadataVerifiedAt',
  'metadataSource',
  'status',
  'requestedScopes',
  'grantedScopes',
  'allowedCapabilities',
  'allowedProviderModels',
  'defaultForWorkspace',
  'defaultForUser',
  'expiresAt',
  'lastRotatedAt',
  'rotationRequiredAt',
  'createdAt',
  'updatedAt',
  'lastUsedAt',
  'lastHealthCheckedAt',
  'lastHealthStatus',
  'revokedAt',
  'deletedAt',
]);

/**
 * Projects a persisted connection row into a browser-safe shape.
 *
 * `rotationInProgress` and `secretStatus` are intentionally collapsed into
 * `status` semantics rather than exposed: WP-7D-02 forbids returning
 * key-management status to browsers.
 */
export function toPublicProviderConnection(connection) {
  if (!connection) {
    return null;
  }
  const projection = {};
  for (const field of PUBLIC_FIELDS) {
    if (connection[field] !== undefined) {
      projection[field] = connection[field];
    }
  }
  return Object.freeze(projection);
}

export function toPublicProviderConnectionList(connections = []) {
  return connections.map((connection) => toPublicProviderConnection(connection));
}
