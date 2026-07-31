/**
 * MuAPI credential migration path (WP-7D-05).
 *
 * Moves an existing MuAPI API key onto the ProviderConnection runtime. The raw
 * key is accepted as an input argument, handed straight to the WP-7D-04
 * service (which seals it into an AES-256-GCM envelope), and then dropped. It
 * is never written to a metadata column, logged, audited, cached, or returned.
 *
 * The legacy conflation this undoes: today an `x-api-key` value is *both* the
 * caller's identity (hashed into `owner_ref`) and the MuAPI credential. After
 * migration those are separate concerns — a Better Auth user/Workspace owns a
 * ProviderConnection, and the credential lives only in the envelope partition.
 *
 * Importing a key therefore does NOT import an identity: no `owner_ref` is
 * derived, and the legacy principal cannot perform the import.
 */

import 'server-only';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';
import { assertProviderConnectionCapablePrincipal, DYNAXIS_MUAPI_PROVIDER_ID } from './resolver.js';
import { toPublicProviderConnection } from './redaction.js';

function textOrNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Imports a legacy MuAPI API key as a ProviderConnection.
 *
 * @param {object} context   canonical AuthContext (human principal)
 * @param {object} input
 * @param {object} input.service        ProviderConnectionService
 * @param {string} input.apiKey         raw MuAPI key — sealed immediately, never persisted raw
 * @param {'user'|'workspace'} input.ownerType
 * @param {string} [input.ownerWorkspaceId]
 * @param {string} [input.ownerUserId]
 * @param {boolean} [input.makeDefault] mark as the owner's default MuAPI connection
 * @returns {Promise<object>} the redacted public ProviderConnection projection
 */
export async function importLegacyMuapiCredential(
  context,
  {
    service,
    apiKey,
    ownerType = 'workspace',
    ownerWorkspaceId = null,
    ownerUserId = null,
    label = 'Migrated MuAPI key',
    makeDefault = false,
    auditCorrelationId = null,
  } = {}
) {
  assertProviderConnectionCapablePrincipal(context);

  if (!service) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      500,
      'A ProviderConnectionService is required'
    );
  }
  const secret = textOrNull(apiKey);
  if (!secret) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
      400,
      'A MuAPI API key is required to migrate'
    );
  }

  // Delegated to the WP-7D-04 service so authorization, sealing, fingerprint,
  // and audit all follow the integrated boundary. Nothing here touches the
  // envelope or key manager directly.
  const created = await service.create(context, {
    providerId: DYNAXIS_MUAPI_PROVIDER_ID,
    ownerType,
    ownerWorkspaceId,
    ownerUserId,
    credentialKind: 'api_key',
    secret,
    label,
    providerDisplayName: 'MuAPI',
    metadataSource: 'user_supplied',
    auditCorrelationId,
  });

  if (!makeDefault) {
    return created;
  }

  // Default routing is part of the creation intent, and `service.create` above
  // already authorized this caller for this exact owner and provider. The
  // service exposes no metadata patch for the default flags (they are routing
  // state, not editable metadata), so the flag is set on the row we just
  // created. The result is re-redacted rather than hand-merged.
  const defaultPatch =
    ownerType === 'workspace' ? { defaultForWorkspace: true } : { defaultForUser: true };
  const updated = await service.repository.updateConnection(created.id, defaultPatch);
  return updated ? toPublicProviderConnection(updated) : created;
}

/**
 * Reports whether a legacy MuAPI key has already been migrated for an owner,
 * *without* accepting or comparing the raw key. Comparison is by provider and
 * ownership only: matching on key material would require a reversible or
 * comparable stored form, which the secret boundary forbids.
 */
export async function hasMigratedMuapiConnection(
  context,
  { service, ownerType = 'workspace', organizationId = null, ownerUserId = null } = {}
) {
  assertProviderConnectionCapablePrincipal(context);
  const rows =
    ownerType === 'workspace'
      ? await service.repository.listConnectionsForWorkspace(
          textOrNull(organizationId || context?.workspace?.organizationId)
        )
      : await service.repository.listConnectionsForUser(
          textOrNull(ownerUserId || context?.principal?.userId)
        );
  return (rows || []).some(
    (row) =>
      textOrNull(row.providerId) === DYNAXIS_MUAPI_PROVIDER_ID &&
      !row.deletedAt &&
      row.status !== 'revoked'
  );
}
