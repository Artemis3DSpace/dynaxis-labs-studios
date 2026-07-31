/**
 * Encrypted secret envelope persistence (WP-7D-03).
 *
 * WP-7D-02 requires complete separation between ProviderConnection metadata
 * and encrypted secret envelopes. This module owns the envelope partition:
 * ciphertext plus the cryptographic parameters and AAD context needed to
 * authenticate it later.
 *
 * This is storage shape only. Nothing here encrypts, decrypts, unwraps,
 * validates AAD at runtime, generates keys, or talks to a KMS / local / test
 * key provider — all of that is WP-7D-04. `key_ref` is a reference to a key
 * (for example `kms://region/alias/version`), never key material.
 *
 * `encrypted_payload`, `auth_tag`, and `iv` are AEAD ciphertext components.
 * They are not raw credential material: no plaintext API key, bearer token,
 * OAuth token, client secret, service-account JSON, webhook secret, or
 * authorization code is ever persisted in any column.
 */

import { pgTable, uuid, text, timestamp, integer, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES,
  dynaxisProviderConnections,
} from '../provider-connections/schema.js';

export const DYNAXIS_SECRET_ENVELOPE_ALGORITHMS = Object.freeze([
  'aes-256-gcm',
  'chacha20-poly1305',
]);

export const DYNAXIS_SECRET_ENVELOPE_STATUSES = Object.freeze([
  'active',
  'superseded',
  'revoked',
  'corrupted',
]);

function sqlList(values) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

export const dynaxisProviderSecretEnvelopes = pgTable(
  'dynaxis_provider_secret_envelopes',
  {
    // envelopeId
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => dynaxisProviderConnections.id, { onDelete: 'cascade' }),
    secretVersion: integer('secret_version').notNull(),

    // Key reference and AEAD parameters. `key_ref` identifies a key by alias
    // or id; key material is never stored.
    keyRef: text('key_ref').notNull(),
    algorithm: text('algorithm').notNull(),
    encryptedPayload: text('encrypted_payload').notNull(),
    authTag: text('auth_tag').notNull(),
    iv: text('iv').notNull(),

    // AAD context columns. WP-7D-02 binds each envelope to
    // ownerType:ownerId:providerId:credentialKind:secretVersion. These columns
    // persist that context so WP-7D-04 can reconstruct and verify the AAD at
    // unwrap time. No validation happens here.
    aadOwnerType: text('aad_owner_type').notNull(),
    aadOwnerId: uuid('aad_owner_id').notNull(),
    aadProviderId: text('aad_provider_id').notNull(),
    aadCredentialKind: text('aad_credential_kind').notNull(),
    aadSecretVersion: integer('aad_secret_version').notNull(),

    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    rotatedFromEnvelopeId: uuid('rotated_from_envelope_id'),
  },
  (t) => ({
    connectionVersionUidx: uniqueIndex('dynaxis_provider_secret_envelopes_connection_version_uidx').on(
      t.connectionId,
      t.secretVersion
    ),
    connectionIdx: index('dynaxis_provider_secret_envelopes_connection_idx').on(t.connectionId),
    statusIdx: index('dynaxis_provider_secret_envelopes_status_idx').on(t.status),
    keyRefIdx: index('dynaxis_provider_secret_envelopes_key_ref_idx').on(t.keyRef),
    rotatedFromIdx: index('dynaxis_provider_secret_envelopes_rotated_from_idx').on(
      t.rotatedFromEnvelopeId
    ),
    aadOwnerIdx: index('dynaxis_provider_secret_envelopes_aad_owner_idx').on(
      t.aadOwnerType,
      t.aadOwnerId
    ),

    algorithmCheck: check(
      'dynaxis_provider_secret_envelopes_algorithm_check',
      sql`${t.algorithm} in (${sqlList(DYNAXIS_SECRET_ENVELOPE_ALGORITHMS)})`
    ),
    statusCheck: check(
      'dynaxis_provider_secret_envelopes_status_check',
      sql`${t.status} in (${sqlList(DYNAXIS_SECRET_ENVELOPE_STATUSES)})`
    ),
    aadOwnerTypeCheck: check(
      'dynaxis_provider_secret_envelopes_aad_owner_type_check',
      sql`${t.aadOwnerType} in (${sqlList(DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES)})`
    ),
    // The AAD version must match the envelope version it binds.
    aadVersionCheck: check(
      'dynaxis_provider_secret_envelopes_aad_version_check',
      sql`${t.aadSecretVersion} = ${t.secretVersion}`
    ),
    secretVersionCheck: check(
      'dynaxis_provider_secret_envelopes_secret_version_check',
      sql`${t.secretVersion} >= 1`
    ),
    // An envelope cannot be rotated from itself.
    rotatedFromSelfCheck: check(
      'dynaxis_provider_secret_envelopes_rotated_from_self_check',
      sql`${t.rotatedFromEnvelopeId} is null or ${t.rotatedFromEnvelopeId} <> ${t.id}`
    ),
  })
);

export const dynaxisProviderSecretEnvelopesRelations = relations(
  dynaxisProviderSecretEnvelopes,
  ({ one }) => ({
    connection: one(dynaxisProviderConnections, {
      fields: [dynaxisProviderSecretEnvelopes.connectionId],
      references: [dynaxisProviderConnections.id],
    }),
  })
);

export const DYNAXIS_SECRET_ENVELOPE_DRIZZLE_SCHEMA = Object.freeze({
  dynaxisProviderSecretEnvelopes,
  dynaxisProviderSecretEnvelopesRelations,
});
