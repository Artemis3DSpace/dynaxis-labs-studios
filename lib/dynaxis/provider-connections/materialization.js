/**
 * Server-only credential materialization boundary (WP-7D-04).
 *
 * This is the ONLY place plaintext provider credentials come into existence at
 * runtime. WP-7D-01 requires materialization to happen strictly after:
 *
 *   1. the AuthContext principal is accepted;
 *   2. the operation has passed Dynaxis authorization;
 *   3. the connection owner matches the operation context;
 *   4. the connection status is `active`;
 *   5. provider/capability/model/scope constraints match;
 *   6. the envelope can be unwrapped under WP-7D-02 key-management rules;
 *   7. an audit event can be written.
 *
 * Rules for callers:
 *   - provider adapters must NOT import this module, `../secrets/envelope.js`,
 *     or `../secrets/keys.js`; they receive plaintext as a call argument and
 *     must not retain, cache, or log it;
 *   - plaintext must never be returned to a browser, placed in an API response,
 *     written to a Job payload, or stored in a durable cache;
 *   - `useProviderCredential()` scopes plaintext to a single callback so it is
 *     not handed out as a long-lived value.
 */

import 'server-only';
import { openSecret } from '../secrets/envelope.js';
import { DYNAXIS_SECRET_ERROR_CODES } from '../secrets/errors.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';
import { PROVIDER_CONNECTION_AUDIT_EVENTS } from './audit.js';
import { connectionSecretContext, SECRET_BEARING_CREDENTIAL_KINDS } from './service.js';

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/** Maps a secret-layer failure onto the WP-7D-01 error contract. */
function mapSecretFailure(error) {
  switch (error?.code) {
    case DYNAXIS_SECRET_ERROR_CODES.AAD_MISMATCH:
      return {
        error: providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
          403,
          'Secret envelope context does not match this ProviderConnection'
        ),
        secretStatus: 'corrupted',
      };
    case DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT:
      return {
        error: providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT,
          500,
          'Secret envelope failed authenticated decryption'
        ),
        secretStatus: 'corrupted',
      };
    case DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE:
    case DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_UNCONFIGURED:
    case DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_FORBIDDEN_ENVIRONMENT:
    case DYNAXIS_SECRET_ERROR_CODES.KEY_REF_INVALID:
      return {
        error: providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.SECRET_UNAVAILABLE,
          503,
          'Secret key is unavailable for this ProviderConnection'
        ),
        secretStatus: 'missing',
      };
    case DYNAXIS_SECRET_ERROR_CODES.UNSUPPORTED_ALGORITHM:
      return {
        error: providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT,
          500,
          'Secret envelope uses an unsupported algorithm'
        ),
        secretStatus: 'corrupted',
      };
    default:
      return {
        error: providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.SECRET_UNAVAILABLE,
          500,
          'Secret material could not be materialized'
        ),
        secretStatus: null,
      };
  }
}

/**
 * Materializes plaintext credential material for immediate provider dispatch.
 *
 * @returns {Promise<{ connectionId, providerId, credentialKind, secretVersion, secret }>}
 *   `secret` is plaintext and must be consumed immediately.
 */
export async function materializeProviderCredential(
  context,
  {
    service,
    connectionId,
    projectScoped = false,
    project = null,
    capabilityId = null,
    modelId = null,
    correlationId = null,
  } = {}
) {
  if (!service) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A ProviderConnectionService is required'
    );
  }
  const auditor = service.auditor;

  await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_ATTEMPTED, {
    connectionId: textOrNull(connectionId),
    actorUserId: context?.principal?.userId,
    projectId: project?.projectId,
    correlationId,
  });

  // Steps 1-4: authorization, ownership, and lifecycle state, all fail-closed.
  let connection;
  try {
    connection = await service.resolveForUse(context, {
      connectionId,
      projectScoped,
      project,
      correlationId,
    });
  } catch (error) {
    await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
      connectionId: textOrNull(connectionId),
      errorCode: error?.code,
      actorUserId: context?.principal?.userId,
      correlationId,
    });
    throw error;
  }

  // Step 5: capability and model constraints.
  if (capabilityId && Array.isArray(connection.allowedCapabilities) && connection.allowedCapabilities.length) {
    if (!connection.allowedCapabilities.includes(capabilityId)) {
      const error = providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.CAPABILITY_DENIED,
        403,
        'ProviderConnection is not permitted for this capability'
      );
      await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
        connectionId: connection.id,
        providerId: connection.providerId,
        errorCode: error.code,
        correlationId,
      });
      throw error;
    }
  }
  if (modelId && Array.isArray(connection.allowedProviderModels) && connection.allowedProviderModels.length) {
    if (!connection.allowedProviderModels.includes(modelId)) {
      const error = providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.MODEL_DENIED,
        403,
        'ProviderConnection is not permitted for this model'
      );
      await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
        connectionId: connection.id,
        providerId: connection.providerId,
        errorCode: error.code,
        correlationId,
      });
      throw error;
    }
  }

  if (!SECRET_BEARING_CREDENTIAL_KINDS.includes(connection.credentialKind)) {
    // `no_secret_required` / `local_runtime_reference` never unwrap anything.
    await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_SUCCEEDED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      credentialKind: connection.credentialKind,
      correlationId,
    });
    return {
      connectionId: connection.id,
      providerId: connection.providerId,
      credentialKind: connection.credentialKind,
      secretVersion: null,
      secret: null,
    };
  }

  // Step 6: load the active envelope and unwrap under the persisted context.
  const envelope = connection.secretRef
    ? await service.repository.findEnvelopeById(connection.secretRef)
    : await service.repository.findLatestEnvelope(connection.id);

  if (!envelope) {
    await service.markSecretStatus(connection.id, 'missing', { correlationId });
    const error = providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
      500,
      'ProviderConnection has no secret envelope'
    );
    await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      errorCode: error.code,
      correlationId,
    });
    throw error;
  }

  if (envelope.status !== 'active') {
    const error = providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED,
      409,
      'ProviderConnection secret envelope is not active'
    );
    await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      errorCode: error.code,
      correlationId,
    });
    throw error;
  }

  let secret;
  try {
    secret = await openSecret({
      envelope,
      // Rebuilt from the persisted connection row, never from request input.
      expectedContext: connectionSecretContext(connection, envelope.secretVersion),
      keyManager: service.keyManager,
    });
  } catch (secretFailure) {
    const mapped = mapSecretFailure(secretFailure);
    if (mapped.secretStatus) {
      await service.markSecretStatus(connection.id, mapped.secretStatus, { correlationId });
    }
    await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_FAILED, {
      connectionId: connection.id,
      providerId: connection.providerId,
      errorCode: mapped.error.code,
      correlationId,
    });
    throw mapped.error;
  }

  // Step 7: audit success without any secret material.
  await auditor.record(PROVIDER_CONNECTION_AUDIT_EVENTS.USE_SUCCEEDED, {
    connectionId: connection.id,
    providerId: connection.providerId,
    credentialKind: connection.credentialKind,
    secretVersion: envelope.secretVersion,
    credentialFingerprint: connection.credentialFingerprint,
    correlationId,
  });

  // Deliberately not frozen: `useProviderCredential` scrubs `secret` after
  // dispatch, and a frozen object would make that assignment throw in strict
  // mode (ESM modules are always strict).
  return {
    connectionId: connection.id,
    providerId: connection.providerId,
    credentialKind: connection.credentialKind,
    secretVersion: envelope.secretVersion,
    secret,
  };
}

/**
 * Scopes plaintext to a single dispatch callback. Preferred over calling
 * `materializeProviderCredential` directly: the plaintext reference is dropped
 * as soon as the callback returns, so it cannot be retained by accident.
 */
export async function useProviderCredential(context, options, dispatch) {
  if (typeof dispatch !== 'function') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A dispatch callback is required'
    );
  }
  const materialized = await materializeProviderCredential(context, options);
  try {
    return await dispatch(materialized);
  } finally {
    // Best-effort: drop our reference to the plaintext immediately.
    materialized.secret = null;
  }
}
