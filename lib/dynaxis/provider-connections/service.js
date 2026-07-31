/**
 * Server-only ProviderConnection service (WP-7D-04).
 *
 * Owns the connection lifecycle on top of the WP-7D-03 storage shape:
 * create, read, list, update, rotate, revoke, soft-delete, and resolve-for-use.
 *
 * Ordering is fixed and fail-closed for every operation:
 *   1. load the persisted connection (ownership is a property of the row);
 *   2. authorize the caller against that row via `authorizeProviderConnection`;
 *   3. only then evaluate lifecycle state and touch secret material.
 *
 * Raw credential material enters only through `create`/`rotate` inputs, is
 * immediately sealed into an envelope, and is never written to the connection
 * row, returned, logged, or audited.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { ALLOW } from '../auth/policy.js';
import { credentialFingerprint, sealSecret } from '../secrets/envelope.js';
import { dynaxisKeyManager } from '../secrets/keys.js';
import {
  DYNAXIS_PROVIDER_CREDENTIAL_KINDS,
  DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES,
} from './schema.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';
import { authorizeProviderConnection, OWNER_MISMATCH } from './policy.js';
import { PROVIDER_CONNECTION_AUDIT_EVENTS, providerConnectionAuditor } from './audit.js';
import { toPublicProviderConnection, toPublicProviderConnectionList } from './redaction.js';

/** Credential kinds that require a sealed envelope before becoming active. */
export const SECRET_BEARING_CREDENTIAL_KINDS = Object.freeze([
  'api_key',
  'bearer_token',
  'oauth_access_refresh_token',
  'oauth_client_secret',
  'service_account_json',
  'webhook_secret',
]);

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function invalid(message) {
  return providerConnectionError(
    PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
    400,
    message
  );
}

function notFound() {
  return providerConnectionError(
    PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
    404,
    'ProviderConnection not found'
  );
}

function forbidden(decision) {
  const code =
    decision?.reason === OWNER_MISMATCH
      ? PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
      : PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN;
  return providerConnectionError(code, 403, 'ProviderConnection access denied', { decision });
}

function ownerIdFor(connection) {
  return connection.ownerType === 'user'
    ? textOrNull(connection.ownerUserId)
    : textOrNull(connection.ownerWorkspaceId);
}

/**
 * Rebuilds the AAD context from the *persisted* connection row. Request input
 * is never used here, so a caller cannot steer the binding.
 */
export function connectionSecretContext(connection, secretVersion) {
  return {
    ownerType: connection.ownerType,
    ownerId: ownerIdFor(connection),
    providerId: connection.providerId,
    credentialKind: connection.credentialKind,
    secretVersion,
  };
}

export class ProviderConnectionService {
  constructor({
    repository,
    keyManager = dynaxisKeyManager,
    auditor = providerConnectionAuditor,
    now = () => new Date(),
  } = {}) {
    if (!repository) {
      throw new Error('ProviderConnectionService requires a repository');
    }
    this.repository = repository;
    this.keyManager = keyManager;
    this.auditor = auditor;
    this.now = now;
  }

  async #authorize(context, permission, connection, opts = {}) {
    const decision = authorizeProviderConnection({
      permission,
      principal: context?.principal || null,
      workspace: opts.workspace || context?.workspace || null,
      project: opts.project || context?.project || null,
      connection,
      projectScoped: opts.projectScoped === true,
    });
    if (decision.reason !== ALLOW) {
      await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.DENIED, {
        permission,
        connectionId: connection?.id,
        providerId: connection?.providerId,
        reasonCode: decision.reason,
        actorUserId: context?.principal?.userId,
        correlationId: opts.correlationId,
      });
      throw forbidden(decision);
    }
    return decision;
  }

  async #loadOrThrow(connectionId) {
    const id = textOrNull(connectionId);
    if (!id) {
      throw invalid('connectionId is required');
    }
    const connection = await this.repository.findConnectionById(id);
    if (!connection) {
      throw notFound();
    }
    return connection;
  }

  /**
   * Fail-closed lifecycle gate. Ordered most-specific first so callers get the
   * precise WP-7D-01 error code.
   */
  assertUsable(connection, { at = this.now() } = {}) {
    if (connection.deletedAt || connection.status === 'deleted') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.DELETED,
        409,
        'ProviderConnection is deleted'
      );
    }
    if (connection.revokedAt || connection.status === 'revoked') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.REVOKED,
        409,
        'ProviderConnection is revoked'
      );
    }
    if (
      connection.status === 'rotation_required' ||
      connection.rotationInProgress === true ||
      (connection.rotationRequiredAt && new Date(connection.rotationRequiredAt) <= at)
    ) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED,
        409,
        'ProviderConnection requires secret rotation'
      );
    }
    if (connection.status !== 'active') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.INACTIVE,
        409,
        'ProviderConnection is not active'
      );
    }
    if (connection.expiresAt && new Date(connection.expiresAt) <= at) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.SECRET_EXPIRED,
        409,
        'ProviderConnection credential has expired'
      );
    }
    if (connection.secretStatus === 'corrupted') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT,
        500,
        'ProviderConnection secret envelope is corrupted'
      );
    }
    if (connection.secretStatus === 'missing') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
        500,
        'ProviderConnection secret envelope is missing'
      );
    }
    if (connection.secretStatus === 'rotation_required') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED,
        409,
        'ProviderConnection requires secret rotation'
      );
    }
    return true;
  }

  async #sealAndAttach(connection, secret, { secretVersion, keyRef = null }) {
    const sealed = await sealSecret({
      plaintext: secret,
      context: connectionSecretContext(connection, secretVersion),
      keyRef,
      keyManager: this.keyManager,
    });

    const envelope = await this.repository.insertEnvelope({
      id: randomUUID(),
      connectionId: connection.id,
      secretVersion: sealed.secretVersion,
      keyRef: sealed.keyRef,
      algorithm: sealed.algorithm,
      encryptedPayload: sealed.encryptedPayload,
      authTag: sealed.authTag,
      iv: sealed.iv,
      aadOwnerType: sealed.aadOwnerType,
      aadOwnerId: sealed.aadOwnerId,
      aadProviderId: sealed.aadProviderId,
      aadCredentialKind: sealed.aadCredentialKind,
      aadSecretVersion: sealed.aadSecretVersion,
      status: 'active',
      createdAt: this.now(),
    });

    return { sealed, envelope };
  }

  async create(context, input = {}) {
    const providerId = textOrNull(input.providerId);
    const ownerType = textOrNull(input.ownerType);
    const credentialKind = textOrNull(input.credentialKind);

    if (!providerId) throw invalid('providerId is required');
    if (!DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES.includes(ownerType)) {
      throw invalid('ownerType must be user or workspace');
    }
    if (!DYNAXIS_PROVIDER_CREDENTIAL_KINDS.includes(credentialKind)) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.UNSUPPORTED_CREDENTIAL_KIND,
        400,
        'Unsupported credential kind'
      );
    }

    const ownerUserId = ownerType === 'user' ? textOrNull(input.ownerUserId) : null;
    const ownerWorkspaceId = ownerType === 'workspace' ? textOrNull(input.ownerWorkspaceId) : null;
    if (ownerType === 'user' && !ownerUserId) throw invalid('ownerUserId is required');
    if (ownerType === 'workspace' && !ownerWorkspaceId) throw invalid('ownerWorkspaceId is required');

    // Authorize against the proposed ownership before writing anything.
    const proposed = { ownerType, ownerUserId, ownerWorkspaceId, providerId, credentialKind };
    await this.#authorize(context, 'provider_connection.create', proposed, {
      correlationId: input.auditCorrelationId,
    });

    const secret = textOrNull(input.secret);
    const requiresSecret = SECRET_BEARING_CREDENTIAL_KINDS.includes(credentialKind);
    if (requiresSecret && !secret) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
        400,
        'Credential material is required for this credential kind'
      );
    }
    if (!requiresSecret && secret) {
      throw invalid('This credential kind must not carry credential material');
    }

    const actorUserId = textOrNull(context?.principal?.userId);
    const created = await this.repository.insertConnection({
      id: randomUUID(),
      providerId,
      ownerType,
      ownerUserId,
      ownerWorkspaceId,
      createdByUserId: actorUserId,
      lastUpdatedByUserId: actorUserId,
      credentialKind,
      status: 'pending_verification',
      label: textOrNull(input.label),
      providerDisplayName: textOrNull(input.providerDisplayName),
      providerAccountId: textOrNull(input.providerAccountId),
      providerAccountLabel: textOrNull(input.providerAccountLabel),
      providerRegion: textOrNull(input.providerRegion),
      metadataSource: textOrNull(input.metadataSource),
      requestedScopes: input.requestedScopes || [],
      grantedScopes: input.grantedScopes || [],
      allowedCapabilities: input.allowedCapabilities || [],
      allowedProviderModels: input.allowedProviderModels || [],
      auditCorrelationId: textOrNull(input.auditCorrelationId),
      createdAt: this.now(),
      updatedAt: this.now(),
    });

    if (!created) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
        500,
        'Failed to create ProviderConnection'
      );
    }

    let finalRow = created;
    if (requiresSecret) {
      const { sealed, envelope } = await this.#sealAndAttach(created, secret, {
        secretVersion: 1,
        keyRef: textOrNull(input.keyRef),
      });
      finalRow = await this.repository.updateConnection(created.id, {
        secretRef: envelope?.id || null,
        secretVersion: sealed.secretVersion,
        keyRef: sealed.keyRef,
        credentialFingerprint: credentialFingerprint(secret),
        envelopeCreatedAt: this.now(),
        lastRotatedAt: this.now(),
        secretStatus: 'active',
        status: 'active',
      });
    }

    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.CREATED, {
      connectionId: created.id,
      providerId,
      ownerType,
      credentialKind,
      status: finalRow?.status,
      actorUserId,
      correlationId: textOrNull(input.auditCorrelationId),
    });

    return toPublicProviderConnection(finalRow || created);
  }

  async get(context, connectionId) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.read', connection);
    if (connection.deletedAt) {
      // Tombstones are audit surface, not ordinary read surface.
      await this.#authorize(context, 'provider_connection.audit.read', connection);
    }
    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.READ, {
      connectionId: connection.id,
      providerId: connection.providerId,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnection(connection);
  }

  async list(context, scope = {}) {
    const ownerType = textOrNull(scope.ownerType) || 'workspace';
    let rows = [];
    if (ownerType === 'workspace') {
      const organizationId = textOrNull(
        scope.organizationId || context?.workspace?.organizationId
      );
      if (!organizationId) throw invalid('organizationId is required');
      rows = await this.repository.listConnectionsForWorkspace(organizationId);
    } else {
      const userId = textOrNull(scope.ownerUserId || context?.principal?.userId);
      if (!userId) throw invalid('ownerUserId is required');
      rows = await this.repository.listConnectionsForUser(userId);
    }

    const visible = [];
    for (const row of rows) {
      const decision = authorizeProviderConnection({
        permission: 'provider_connection.read',
        principal: context?.principal || null,
        workspace: context?.workspace || null,
        connection: row,
      });
      if (decision.reason === ALLOW) {
        visible.push(row);
      }
    }

    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.LISTED, {
      ownerType,
      count: visible.length,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnectionList(visible);
  }

  async update(context, connectionId, patch = {}) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.create', connection);

    // Metadata only. Secret and ownership fields are not patchable here.
    const allowed = {};
    for (const field of [
      'label',
      'providerDisplayName',
      'providerAccountId',
      'providerAccountLabel',
      'providerAccountAvatarUrl',
      'providerRegion',
      'metadataSource',
      'requestedScopes',
      'grantedScopes',
      'allowedCapabilities',
      'allowedProviderModels',
    ]) {
      if (patch[field] !== undefined) {
        allowed[field] = patch[field];
      }
    }
    allowed.lastUpdatedByUserId = textOrNull(context?.principal?.userId);
    if (patch.metadataVerifiedAt !== undefined) {
      allowed.metadataVerifiedAt = patch.metadataVerifiedAt;
    }

    const updated = await this.repository.updateConnection(connection.id, allowed);
    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.UPDATED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnection(updated);
  }

  async rotate(context, connectionId, { secret } = {}) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.rotate', connection);

    if (connection.deletedAt || connection.status === 'deleted') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.DELETED,
        409,
        'Cannot rotate a deleted ProviderConnection'
      );
    }
    if (connection.revokedAt || connection.status === 'revoked') {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.REVOKED,
        409,
        'Cannot rotate a revoked ProviderConnection'
      );
    }
    if (!SECRET_BEARING_CREDENTIAL_KINDS.includes(connection.credentialKind)) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.UNSUPPORTED_CREDENTIAL_KIND,
        400,
        'This credential kind has no rotatable secret'
      );
    }
    const value = textOrNull(secret);
    if (!value) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
        400,
        'Replacement credential material is required'
      );
    }

    const nextVersion = Number(connection.secretVersion || 0) + 1;
    const { sealed, envelope } = await this.#sealAndAttach(connection, value, {
      secretVersion: nextVersion,
      keyRef: connection.keyRef || null,
    });

    const updated = await this.repository.updateConnection(connection.id, {
      secretRef: envelope?.id || null,
      secretVersion: sealed.secretVersion,
      keyRef: sealed.keyRef,
      credentialFingerprint: credentialFingerprint(value),
      envelopeCreatedAt: this.now(),
      lastRotatedAt: this.now(),
      rotationRequiredAt: null,
      rotationInProgress: false,
      secretStatus: 'active',
      status: 'active',
      lastUpdatedByUserId: textOrNull(context?.principal?.userId),
    });

    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.ROTATED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      secretVersion: sealed.secretVersion,
      algorithm: sealed.algorithm,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnection(updated);
  }

  async revoke(context, connectionId) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.revoke', connection);
    if (connection.deletedAt) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.DELETED,
        409,
        'ProviderConnection is already deleted'
      );
    }

    const updated = await this.repository.updateConnection(connection.id, {
      status: 'revoked',
      revokedAt: this.now(),
      revokedByUserId: textOrNull(context?.principal?.userId),
      defaultForUser: false,
      defaultForWorkspace: false,
    });
    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.REVOKED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnection(updated);
  }

  /** Soft delete: tombstone, preserving audit evidence. */
  async remove(context, connectionId) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.delete', connection);

    const updated = await this.repository.updateConnection(connection.id, {
      status: 'deleted',
      deletedAt: this.now(),
      defaultForUser: false,
      defaultForWorkspace: false,
      lastUpdatedByUserId: textOrNull(context?.principal?.userId),
    });
    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.DELETED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      actorUserId: context?.principal?.userId,
    });
    return toPublicProviderConnection(updated);
  }

  /**
   * Resolves a connection for authorized server-side dispatch.
   *
   * Returns the *persisted row*, not a public projection: the caller is the
   * server-side materialization boundary, never a browser. Callers outside
   * `materialization.js` must not use this to read secret references.
   */
  async resolveForUse(context, { connectionId, projectScoped = false, project = null, correlationId = null } = {}) {
    const connection = await this.#loadOrThrow(connectionId);
    await this.#authorize(context, 'provider_connection.use', connection, {
      projectScoped,
      project,
      correlationId,
    });
    this.assertUsable(connection);
    return connection;
  }

  /** Records a secretStatus transition discovered at runtime. */
  async markSecretStatus(connectionId, secretStatus, { correlationId = null } = {}) {
    const connection = await this.repository.findConnectionById(connectionId);
    if (!connection || connection.secretStatus === secretStatus) {
      return connection || null;
    }
    const updated = await this.repository.updateConnection(connectionId, { secretStatus });
    await this.auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.SECRET_STATUS_CHANGED, {
      connectionId,
      providerId: connection.providerId,
      previousSecretStatus: connection.secretStatus,
      secretStatus,
      correlationId,
    });
    return updated;
  }
}

export function createProviderConnectionService(opts = {}) {
  return new ProviderConnectionService(opts);
}
