/**
 * ProviderConnection metadata persistence (WP-7D-03).
 *
 * A ProviderConnection binds provider credential *metadata* to a Dynaxis user
 * or Workspace. It is never a Dynaxis identity or authorization subject: the
 * owner columns reference Better Auth `auth.user` / `auth.organization` rows,
 * and every provider-account column is display metadata only.
 *
 * This module is storage shape only. Raw credential material is never stored
 * here — the connection carries an opaque `secret_ref` pointing at an
 * encrypted envelope (see `lib/dynaxis/secrets/schema.js`). Encryption,
 * decryption, unwrap, AAD runtime validation, and key management belong to
 * WP-7D-04.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organization, user } from '../auth/schema.js';

export const DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES = Object.freeze(['user', 'workspace']);

export const DYNAXIS_PROVIDER_CREDENTIAL_KINDS = Object.freeze([
  'api_key',
  'bearer_token',
  'oauth_access_refresh_token',
  'oauth_client_secret',
  'service_account_json',
  'webhook_secret',
  'local_runtime_reference',
  'no_secret_required',
]);

export const DYNAXIS_PROVIDER_CONNECTION_STATUSES = Object.freeze([
  'pending_verification',
  'active',
  'disabled',
  'rotation_required',
  'revoked',
  'provider_error',
  'deleted',
]);

export const DYNAXIS_PROVIDER_CONNECTION_SECRET_STATUSES = Object.freeze([
  'active',
  'rotation_required',
  'corrupted',
  'missing',
]);

export const DYNAXIS_PROVIDER_CONNECTION_METADATA_SOURCES = Object.freeze([
  'user_supplied',
  'provider_verified',
  'system_inferred',
]);

/** Credential kinds that must never carry a secret envelope reference. */
export const DYNAXIS_PROVIDER_SECRETLESS_CREDENTIAL_KINDS = Object.freeze(['no_secret_required']);

function sqlList(values) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

export const dynaxisProviderConnections = pgTable(
  'dynaxis_provider_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: text('provider_id').notNull(),

    // Ownership. Exactly one owner target is active; enforced by check below.
    ownerType: text('owner_type').notNull(),
    ownerUserId: uuid('owner_user_id').references(() => user.id, { onDelete: 'restrict' }),
    ownerWorkspaceId: uuid('owner_workspace_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),

    // Audit actors. These are never owners and never grant authority.
    createdByUserId: uuid('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    lastUpdatedByUserId: uuid('last_updated_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => user.id, { onDelete: 'set null' }),

    // Credential metadata and secret-envelope references. `secret_ref` is an
    // opaque server-only pointer at the active envelope id; it is deliberately
    // not a foreign key so the metadata partition never depends on envelope
    // storage availability and the two partitions stay independently
    // deletable. Envelope -> connection integrity is enforced on the envelope
    // side instead.
    credentialKind: text('credential_kind').notNull(),
    secretRef: uuid('secret_ref'),
    secretVersion: integer('secret_version'),
    keyRef: text('key_ref'),
    credentialFingerprint: text('credential_fingerprint'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),
    rotationRequiredAt: timestamp('rotation_required_at', { withTimezone: true }),
    envelopeCreatedAt: timestamp('envelope_created_at', { withTimezone: true }),
    rotationInProgress: boolean('rotation_in_progress').notNull().default(false),
    secretStatus: text('secret_status'),

    // Display metadata. Non-authoritative and privacy-sensitive; never an
    // authentication principal or authorization subject.
    label: text('label'),
    providerDisplayName: text('provider_display_name'),
    providerAccountId: text('provider_account_id'),
    providerAccountLabel: text('provider_account_label'),
    providerAccountAvatarUrl: text('provider_account_avatar_url'),
    providerRegion: text('provider_region'),
    metadataVerifiedAt: timestamp('metadata_verified_at', { withTimezone: true }),
    metadataSource: text('metadata_source'),

    status: text('status').notNull().default('pending_verification'),

    // Scope and capability eligibility. Provider scopes never grant Dynaxis
    // permissions; both vocabularies are recorded separately.
    requestedScopes: jsonb('requested_scopes').$type().notNull().default([]),
    grantedScopes: jsonb('granted_scopes').$type().notNull().default([]),
    allowedCapabilities: jsonb('allowed_capabilities').$type().notNull().default([]),
    allowedProviderModels: jsonb('allowed_provider_models').$type().notNull().default([]),
    defaultForWorkspace: boolean('default_for_workspace').notNull().default(false),
    defaultForUser: boolean('default_for_user').notNull().default(false),

    // Audit and tombstone fields. Job/Generation references are intentionally
    // plain uuids rather than foreign keys so audit history survives Job or
    // Generation retention pruning.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastUseJobId: uuid('last_use_job_id'),
    lastUseGenerationId: uuid('last_use_generation_id'),
    lastHealthCheckedAt: timestamp('last_health_checked_at', { withTimezone: true }),
    lastHealthStatus: text('last_health_status'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    auditCorrelationId: text('audit_correlation_id'),
  },
  (t) => ({
    ownerUserIdx: index('dynaxis_provider_connections_owner_user_idx').on(t.ownerUserId),
    ownerWorkspaceIdx: index('dynaxis_provider_connections_owner_workspace_idx').on(
      t.ownerWorkspaceId
    ),
    providerIdx: index('dynaxis_provider_connections_provider_idx').on(t.providerId),
    statusIdx: index('dynaxis_provider_connections_status_idx').on(t.status),
    workspaceProviderStatusIdx: index('dynaxis_provider_connections_workspace_provider_idx').on(
      t.ownerWorkspaceId,
      t.providerId,
      t.status
    ),
    userProviderStatusIdx: index('dynaxis_provider_connections_user_provider_idx').on(
      t.ownerUserId,
      t.providerId,
      t.status
    ),
    secretRefIdx: index('dynaxis_provider_connections_secret_ref_idx').on(t.secretRef),
    secretStatusIdx: index('dynaxis_provider_connections_secret_status_idx').on(t.secretStatus),
    rotationIdx: index('dynaxis_provider_connections_rotation_idx').on(
      t.rotationInProgress,
      t.rotationRequiredAt
    ),
    deletedAtIdx: index('dynaxis_provider_connections_deleted_at_idx').on(t.deletedAt),
    auditCorrelationIdx: index('dynaxis_provider_connections_audit_correlation_idx').on(
      t.auditCorrelationId
    ),

    // At most one live default connection per owner per provider. Scoped by
    // provider so multi-provider and multi-capability routing stays possible.
    workspaceDefaultUidx: uniqueIndex('dynaxis_provider_connections_workspace_default_uidx')
      .on(t.ownerWorkspaceId, t.providerId)
      .where(sql`"default_for_workspace" = true AND "deleted_at" IS NULL`),
    userDefaultUidx: uniqueIndex('dynaxis_provider_connections_user_default_uidx')
      .on(t.ownerUserId, t.providerId)
      .where(sql`"default_for_user" = true AND "deleted_at" IS NULL`),

    ownerTypeCheck: check(
      'dynaxis_provider_connections_owner_type_check',
      sql`${t.ownerType} in (${sqlList(DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES)})`
    ),
    // ownerType user requires ownerUserId and forbids ownerWorkspaceId;
    // ownerType workspace requires ownerWorkspaceId and forbids ownerUserId.
    ownerTargetCheck: check(
      'dynaxis_provider_connections_owner_target_check',
      sql`(${t.ownerType} = 'user' and ${t.ownerUserId} is not null and ${t.ownerWorkspaceId} is null)
        or (${t.ownerType} = 'workspace' and ${t.ownerWorkspaceId} is not null and ${t.ownerUserId} is null)`
    ),
    defaultScopeCheck: check(
      'dynaxis_provider_connections_default_scope_check',
      sql`(${t.defaultForWorkspace} = false or ${t.ownerType} = 'workspace')
        and (${t.defaultForUser} = false or ${t.ownerType} = 'user')`
    ),
    credentialKindCheck: check(
      'dynaxis_provider_connections_credential_kind_check',
      sql`${t.credentialKind} in (${sqlList(DYNAXIS_PROVIDER_CREDENTIAL_KINDS)})`
    ),
    statusCheck: check(
      'dynaxis_provider_connections_status_check',
      sql`${t.status} in (${sqlList(DYNAXIS_PROVIDER_CONNECTION_STATUSES)})`
    ),
    secretStatusCheck: check(
      'dynaxis_provider_connections_secret_status_check',
      sql`${t.secretStatus} is null or ${t.secretStatus} in (${sqlList(
        DYNAXIS_PROVIDER_CONNECTION_SECRET_STATUSES
      )})`
    ),
    metadataSourceCheck: check(
      'dynaxis_provider_connections_metadata_source_check',
      sql`${t.metadataSource} is null or ${t.metadataSource} in (${sqlList(
        DYNAXIS_PROVIDER_CONNECTION_METADATA_SOURCES
      )})`
    ),
    // `no_secret_required` never carries envelope references or a fingerprint.
    secretlessCheck: check(
      'dynaxis_provider_connections_secretless_check',
      sql`${t.credentialKind} <> 'no_secret_required'
        or (${t.secretRef} is null and ${t.secretVersion} is null and ${t.credentialFingerprint} is null)`
    ),
    // Tombstone/audit semantics: revoked and deleted states must record when.
    revokedTombstoneCheck: check(
      'dynaxis_provider_connections_revoked_tombstone_check',
      sql`${t.status} <> 'revoked' or ${t.revokedAt} is not null`
    ),
    deletedTombstoneCheck: check(
      'dynaxis_provider_connections_deleted_tombstone_check',
      sql`${t.status} <> 'deleted' or ${t.deletedAt} is not null`
    ),
    secretVersionCheck: check(
      'dynaxis_provider_connections_secret_version_check',
      sql`${t.secretVersion} is null or ${t.secretVersion} >= 1`
    ),
  })
);

export const dynaxisProviderConnectionsRelations = relations(
  dynaxisProviderConnections,
  ({ one }) => ({
    ownerUser: one(user, {
      fields: [dynaxisProviderConnections.ownerUserId],
      references: [user.id],
    }),
    ownerWorkspace: one(organization, {
      fields: [dynaxisProviderConnections.ownerWorkspaceId],
      references: [organization.id],
    }),
  })
);

export const DYNAXIS_PROVIDER_CONNECTION_DRIZZLE_SCHEMA = Object.freeze({
  dynaxisProviderConnections,
  dynaxisProviderConnectionsRelations,
});
