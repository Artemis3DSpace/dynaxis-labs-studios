import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { organization, user } from '../lib/dynaxis/auth/schema.js';
import {
  DYNAXIS_PROVIDER_CONNECTION_DRIZZLE_SCHEMA,
  DYNAXIS_PROVIDER_CONNECTION_METADATA_SOURCES,
  DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES,
  DYNAXIS_PROVIDER_CONNECTION_SECRET_STATUSES,
  DYNAXIS_PROVIDER_CONNECTION_STATUSES,
  DYNAXIS_PROVIDER_CREDENTIAL_KINDS,
  dynaxisProviderConnections,
} from '../lib/dynaxis/provider-connections/schema.js';
import {
  DYNAXIS_SECRET_ENVELOPE_ALGORITHMS,
  DYNAXIS_SECRET_ENVELOPE_DRIZZLE_SCHEMA,
  DYNAXIS_SECRET_ENVELOPE_STATUSES,
  dynaxisProviderSecretEnvelopes,
} from '../lib/dynaxis/secrets/schema.js';
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

const MIGRATION = source('drizzle/0015_phase_7d_3_provider_connections.sql');
const JOURNAL = JSON.parse(source('drizzle/meta/_journal.json'));

function columnNames(table) {
  return Object.values(getTableColumns(table)).map((column) => column.name);
}

/**
 * Strips block comments and whole-line `//` comments so runtime assertions
 * scan code rather than documentation. The schema modules deliberately
 * document the boundary they must not cross (for example naming KMS as the
 * WP-7D-04 key provider, or `kms://` as a `key_ref` format), and describing
 * that boundary is not implementing it.
 */
function codeWithoutComments(body) {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

function indexNames(table) {
  return getTableConfig(table).indexes.map((idx) => idx.config.name);
}

function checkNames(table) {
  return getTableConfig(table).checks.map((entry) => entry.name);
}

/**
 * Column-name patterns that would imply raw credential material at rest.
 * Deliberately matched against real column names rather than migration text:
 * `credential_kind` legitimately enumerates values such as 'api_key' and
 * 'webhook_secret' inside a CHECK constraint, and those enum values are not
 * storage. Bare /secret/ is likewise not forbidden because `secret_ref`,
 * `secret_version`, `secret_status`, and `aad_secret_version` are references
 * and metadata, never secret material.
 */
const FORBIDDEN_COLUMN_PATTERNS = Object.freeze([
  /^api_?key$/i,
  /token/i,
  /^client_secret$/i,
  /service_account/i,
  /webhook_secret/i,
  /plaintext/i,
  /decrypted/i,
  /^password$/i,
  /private_key/i,
  /authorization_code/i,
]);

test('WP-7D-03 exports ProviderConnection and secret envelope tables through the canonical Drizzle schema', () => {
  assert.equal(getTableName(dynaxisProviderConnections), 'dynaxis_provider_connections');
  assert.equal(getTableName(dynaxisProviderSecretEnvelopes), 'dynaxis_provider_secret_envelopes');
  assert.equal(getTableConfig(dynaxisProviderConnections).schema, undefined);
  assert.equal(getTableConfig(dynaxisProviderSecretEnvelopes).schema, undefined);

  assert.ok('dynaxisProviderConnections' in DYNAXIS_PROVIDER_CONNECTION_DRIZZLE_SCHEMA);
  assert.ok('dynaxisProviderSecretEnvelopes' in DYNAXIS_SECRET_ENVELOPE_DRIZZLE_SCHEMA);
  assert.ok('dynaxisProviderConnections' in DRIZZLE_SCHEMA);
  assert.ok('dynaxisProviderSecretEnvelopes' in DRIZZLE_SCHEMA);
});

test('WP-7D-03 ProviderConnection metadata covers the WP-7D-01 contract fields', () => {
  const columns = getTableColumns(dynaxisProviderConnections);
  const expected = [
    'id',
    'provider_id',
    'owner_type',
    'owner_user_id',
    'owner_workspace_id',
    'created_by_user_id',
    'last_updated_by_user_id',
    'revoked_by_user_id',
    'credential_kind',
    'secret_ref',
    'secret_version',
    'key_ref',
    'credential_fingerprint',
    'expires_at',
    'last_rotated_at',
    'rotation_required_at',
    'envelope_created_at',
    'rotation_in_progress',
    'secret_status',
    'label',
    'provider_display_name',
    'provider_account_id',
    'provider_account_label',
    'provider_account_avatar_url',
    'provider_region',
    'metadata_verified_at',
    'metadata_source',
    'status',
    'requested_scopes',
    'granted_scopes',
    'allowed_capabilities',
    'allowed_provider_models',
    'default_for_workspace',
    'default_for_user',
    'created_at',
    'updated_at',
    'last_used_at',
    'last_use_job_id',
    'last_use_generation_id',
    'last_health_checked_at',
    'last_health_status',
    'revoked_at',
    'deleted_at',
    'audit_correlation_id',
  ];

  const actual = columnNames(dynaxisProviderConnections);
  for (const name of expected) {
    assert.ok(actual.includes(name), `ProviderConnection is missing column ${name}`);
  }

  assert.equal(columns.providerId.notNull, true);
  assert.equal(columns.ownerType.notNull, true);
  assert.equal(columns.credentialKind.notNull, true);
  assert.equal(columns.status.notNull, true);
  assert.equal(columns.ownerUserId.notNull, false);
  assert.equal(columns.ownerWorkspaceId.notNull, false);
  assert.equal(columns.rotationInProgress.notNull, true);
  assert.equal(columns.defaultForWorkspace.notNull, true);
  assert.equal(columns.defaultForUser.notNull, true);
});

test('WP-7D-03 owner columns bind to Better Auth, and provider account metadata is never an auth principal', () => {
  const config = getTableConfig(dynaxisProviderConnections);
  const columns = getTableColumns(dynaxisProviderConnections);

  // Owners reference Better Auth user/organization; provider account metadata is plain text.
  assert.equal(columns.ownerUserId.columnType, 'PgUUID');
  assert.equal(columns.ownerWorkspaceId.columnType, 'PgUUID');
  assert.equal(columns.providerAccountId.columnType, 'PgText');
  assert.equal(columns.providerAccountLabel.columnType, 'PgText');
  assert.equal(getTableConfig(user).schema, 'auth');
  assert.equal(getTableConfig(organization).schema, 'auth');

  // Five FKs: two owner targets plus three audit actors. Audit actors are not owners.
  assert.equal(config.foreignKeys.length, 5);

  // Provider account metadata carries no foreign key into identity tables.
  const fkColumns = config.foreignKeys.flatMap((fk) =>
    fk.reference().columns.map((column) => column.name)
  );
  for (const metadataColumn of [
    'provider_account_id',
    'provider_account_label',
    'provider_region',
    'provider_display_name',
  ]) {
    assert.ok(
      !fkColumns.includes(metadataColumn),
      `${metadataColumn} must not reference an identity table`
    );
  }
});

test('WP-7D-03 enforces ownerType invariants with database constraints', () => {
  assert.deepEqual(DYNAXIS_PROVIDER_CONNECTION_OWNER_TYPES, ['user', 'workspace']);

  const checks = checkNames(dynaxisProviderConnections);
  assert.ok(checks.includes('dynaxis_provider_connections_owner_type_check'));
  assert.ok(checks.includes('dynaxis_provider_connections_owner_target_check'));
  assert.ok(checks.includes('dynaxis_provider_connections_default_scope_check'));

  // ownerType user requires ownerUserId and forbids ownerWorkspaceId; workspace is the mirror.
  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_provider_connections_owner_target_check" CHECK \(\("owner_type" = 'user' and "owner_user_id" is not null and "owner_workspace_id" is null\)\s*\n?\s*or \("owner_type" = 'workspace' and "owner_workspace_id" is not null and "owner_user_id" is null\)\)/
  );
  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_provider_connections_owner_type_check" CHECK \("owner_type" in \('user', 'workspace'\)\)/
  );
});

test('WP-7D-03 constrains credential kind, status, secret status, and metadata source vocabularies', () => {
  assert.deepEqual(DYNAXIS_PROVIDER_CREDENTIAL_KINDS, [
    'api_key',
    'bearer_token',
    'oauth_access_refresh_token',
    'oauth_client_secret',
    'service_account_json',
    'webhook_secret',
    'local_runtime_reference',
    'no_secret_required',
  ]);
  assert.deepEqual(DYNAXIS_PROVIDER_CONNECTION_STATUSES, [
    'pending_verification',
    'active',
    'disabled',
    'rotation_required',
    'revoked',
    'provider_error',
    'deleted',
  ]);
  assert.deepEqual(DYNAXIS_PROVIDER_CONNECTION_SECRET_STATUSES, [
    'active',
    'rotation_required',
    'corrupted',
    'missing',
  ]);
  assert.deepEqual(DYNAXIS_PROVIDER_CONNECTION_METADATA_SOURCES, [
    'user_supplied',
    'provider_verified',
    'system_inferred',
  ]);

  const checks = checkNames(dynaxisProviderConnections);
  for (const name of [
    'dynaxis_provider_connections_credential_kind_check',
    'dynaxis_provider_connections_status_check',
    'dynaxis_provider_connections_secret_status_check',
    'dynaxis_provider_connections_metadata_source_check',
    'dynaxis_provider_connections_secretless_check',
    'dynaxis_provider_connections_secret_version_check',
  ]) {
    assert.ok(checks.includes(name), `missing check ${name}`);
    assert.ok(MIGRATION.includes(`CONSTRAINT "${name}"`), `migration missing check ${name}`);
  }
});

test('WP-7D-03 preserves revoked and deleted tombstone audit semantics', () => {
  const checks = checkNames(dynaxisProviderConnections);
  assert.ok(checks.includes('dynaxis_provider_connections_revoked_tombstone_check'));
  assert.ok(checks.includes('dynaxis_provider_connections_deleted_tombstone_check'));

  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_provider_connections_revoked_tombstone_check" CHECK \("status" <> 'revoked' or "revoked_at" is not null\)/
  );
  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_provider_connections_deleted_tombstone_check" CHECK \("status" <> 'deleted' or "deleted_at" is not null\)/
  );

  // Tombstones stay queryable for audit.
  assert.ok(indexNames(dynaxisProviderConnections).includes('dynaxis_provider_connections_deleted_at_idx'));
  assert.ok(
    indexNames(dynaxisProviderConnections).includes(
      'dynaxis_provider_connections_audit_correlation_idx'
    )
  );
});

test('WP-7D-03 secret envelope storage shape matches the WP-7D-02 envelope contract', () => {
  const columns = getTableColumns(dynaxisProviderSecretEnvelopes);
  for (const name of [
    'id',
    'connection_id',
    'secret_version',
    'key_ref',
    'algorithm',
    'encrypted_payload',
    'auth_tag',
    'iv',
    'aad_owner_type',
    'aad_owner_id',
    'aad_provider_id',
    'aad_credential_kind',
    'aad_secret_version',
    'status',
    'created_at',
    'rotated_from_envelope_id',
  ]) {
    assert.ok(
      columnNames(dynaxisProviderSecretEnvelopes).includes(name),
      `envelope is missing column ${name}`
    );
  }

  assert.equal(columns.connectionId.notNull, true);
  assert.equal(columns.keyRef.notNull, true);
  assert.equal(columns.algorithm.notNull, true);
  assert.equal(columns.encryptedPayload.notNull, true);
  assert.equal(columns.authTag.notNull, true);
  assert.equal(columns.iv.notNull, true);

  assert.deepEqual(DYNAXIS_SECRET_ENVELOPE_ALGORITHMS, ['aes-256-gcm', 'chacha20-poly1305']);
  assert.deepEqual(DYNAXIS_SECRET_ENVELOPE_STATUSES, [
    'active',
    'superseded',
    'revoked',
    'corrupted',
  ]);

  const checks = checkNames(dynaxisProviderSecretEnvelopes);
  assert.ok(checks.includes('dynaxis_provider_secret_envelopes_algorithm_check'));
  assert.ok(checks.includes('dynaxis_provider_secret_envelopes_aad_owner_type_check'));
  assert.ok(checks.includes('dynaxis_provider_secret_envelopes_aad_version_check'));
});

test('WP-7D-03 keeps ProviderConnection metadata separate from envelope ciphertext', () => {
  const connectionColumns = columnNames(dynaxisProviderConnections);
  for (const ciphertextColumn of ['encrypted_payload', 'auth_tag', 'iv']) {
    assert.ok(
      !connectionColumns.includes(ciphertextColumn),
      `ProviderConnection metadata must not carry ${ciphertextColumn}`
    );
  }

  // The metadata partition keeps only an opaque reference to the envelope.
  assert.ok(connectionColumns.includes('secret_ref'));
  assert.ok(connectionColumns.includes('secret_version'));
  assert.ok(connectionColumns.includes('key_ref'));

  // Envelope -> connection integrity is enforced on the envelope side.
  const envelopeConfig = getTableConfig(dynaxisProviderSecretEnvelopes);
  assert.equal(envelopeConfig.foreignKeys.length, 1);
  assert.equal(
    envelopeConfig.foreignKeys[0].reference().columns[0].name,
    'connection_id'
  );
});

test('WP-7D-03 persists no raw secret columns in either partition', () => {
  for (const table of [dynaxisProviderConnections, dynaxisProviderSecretEnvelopes]) {
    for (const name of columnNames(table)) {
      for (const pattern of FORBIDDEN_COLUMN_PATTERNS) {
        assert.ok(
          !pattern.test(name),
          `${getTableName(table)}.${name} matches forbidden raw-secret pattern ${pattern}`
        );
      }
    }
  }

  // The migration declares no column whose name implies raw secret storage.
  const declaredColumns = [...MIGRATION.matchAll(/^\t"([a-z0-9_]+)"/gm)].map((match) => match[1]);
  assert.ok(declaredColumns.length > 0, 'migration should declare columns');
  for (const name of declaredColumns) {
    for (const pattern of FORBIDDEN_COLUMN_PATTERNS) {
      assert.ok(!pattern.test(name), `migration column ${name} matches ${pattern}`);
    }
  }
});

test('WP-7D-03 migration creates both tables once and is registered in the journal', () => {
  assert.equal((MIGRATION.match(/CREATE TABLE "dynaxis_provider_connections"/g) || []).length, 1);
  assert.equal(
    (MIGRATION.match(/CREATE TABLE "dynaxis_provider_secret_envelopes"/g) || []).length,
    1
  );

  const entry = JOURNAL.entries.find(
    (item) => item.tag === '0015_phase_7d_3_provider_connections'
  );
  assert.ok(entry, 'journal must register migration 0015');
  assert.equal(entry.idx, 15);
  assert.ok(
    JOURNAL.entries.at(-1).tag === '0015_phase_7d_3_provider_connections' ||
      JOURNAL.entries.at(-1).tag === '0016_phase_7e_4_job_persistence'
  );
});

test('WP-7D-03 migration and schema declare the same indexes and uniqueness', () => {
  for (const name of indexNames(dynaxisProviderConnections)) {
    assert.ok(MIGRATION.includes(`"${name}"`), `migration missing index ${name}`);
  }
  for (const name of indexNames(dynaxisProviderSecretEnvelopes)) {
    assert.ok(MIGRATION.includes(`"${name}"`), `migration missing index ${name}`);
  }

  // Owner, provider, status, secret, rotation, and audit lookups.
  const connectionIndexes = indexNames(dynaxisProviderConnections);
  for (const name of [
    'dynaxis_provider_connections_owner_user_idx',
    'dynaxis_provider_connections_owner_workspace_idx',
    'dynaxis_provider_connections_provider_idx',
    'dynaxis_provider_connections_status_idx',
    'dynaxis_provider_connections_secret_ref_idx',
    'dynaxis_provider_connections_secret_status_idx',
    'dynaxis_provider_connections_rotation_idx',
  ]) {
    assert.ok(connectionIndexes.includes(name), `missing index ${name}`);
  }

  // Default selection uniqueness is scoped per owner and provider, and ignores
  // tombstones, so multi-provider routing stays possible.
  assert.match(
    MIGRATION,
    /CREATE UNIQUE INDEX "dynaxis_provider_connections_workspace_default_uidx" ON "dynaxis_provider_connections" USING btree \("owner_workspace_id","provider_id"\) WHERE "default_for_workspace" = true AND "deleted_at" IS NULL;/
  );
  assert.match(
    MIGRATION,
    /CREATE UNIQUE INDEX "dynaxis_provider_connections_user_default_uidx" ON "dynaxis_provider_connections" USING btree \("owner_user_id","provider_id"\) WHERE "default_for_user" = true AND "deleted_at" IS NULL;/
  );
  assert.match(
    MIGRATION,
    /CREATE UNIQUE INDEX "dynaxis_provider_secret_envelopes_connection_version_uidx" ON "dynaxis_provider_secret_envelopes" USING btree \("connection_id","secret_version"\);/
  );
});

/**
 * WP-7D-03 originally asserted that `lib/dynaxis/provider-connections/` and
 * `lib/dynaxis/secrets/` contained nothing but `schema.js`. WP-7D-04 is
 * chartered to add the runtime those directories were reserved for, so the
 * file-inventory form of this assertion is obsolete. The durable invariant —
 * and the one that actually protects the boundary — is that the *schema
 * modules themselves* stay declarative: no crypto, no key management, no
 * OAuth. That is what is asserted below, unchanged in strength.
 */
test('WP-7D-03 schema modules stay declarative with no encryption, unwrap, or key management runtime', () => {
  assert.ok(existsSync(new URL('lib/dynaxis/provider-connections/schema.js', ROOT)));
  assert.ok(existsSync(new URL('lib/dynaxis/secrets/schema.js', ROOT)));

  const runtimeForbidden = [
    /node:crypto/,
    /createCipheriv|createDecipheriv/,
    /\bencrypt\s*\(/,
    /\bdecrypt\s*\(/,
    /\bunwrap\w*\s*\(/,
    /generateKey|randomBytes/,
    /KMS|kms:\/\//,
    /oauth2|authorize\s*\(|refreshAccessToken/i,
  ];
  for (const file of [
    'lib/dynaxis/provider-connections/schema.js',
    'lib/dynaxis/secrets/schema.js',
  ]) {
    const body = codeWithoutComments(source(file));
    for (const pattern of runtimeForbidden) {
      assert.ok(!pattern.test(body), `${file} must not contain runtime matching ${pattern}`);
    }
  }
});

/**
 * `service.js`, `secrets/envelope.js`, and `secrets/keys.js` are WP-7D-04
 * runtime and now legitimately exist, so asserting their absence is obsolete.
 * What must remain true is that no HTTP route or Studio UI surface exists for
 * ProviderConnections, and that the schema layer never depends on the runtime
 * layer — keeping storage shape independent of secret handling.
 */
/**
 * WP-7D-06 is chartered to add the route and Studio surfaces this test
 * originally asserted were absent, so the absence form is obsolete. The
 * durable invariant is the dependency direction: the storage layer must not
 * depend on the runtime layer, and the route/UI surfaces must not reach into
 * secret internals. Both are asserted below, unchanged in strength.
 */
test('WP-7D-03 storage layer stays independent of routes, UI, and secret runtime', () => {
  const uiApi = 'packages/studio/src/provider-connections/api.js';
  if (existsSync(new URL(uiApi, ROOT))) {
    const body = codeWithoutComments(source(uiApi));
    assert.doesNotMatch(body, /secrets\/(keys|envelope)\.js/, 'UI must not import secret internals');
    assert.doesNotMatch(body, /provider-connections\/(schema|repository)\.js/, 'UI must not import storage');
  }

  for (const file of [
    'lib/dynaxis/provider-connections/schema.js',
    'lib/dynaxis/secrets/schema.js',
  ]) {
    const body = codeWithoutComments(source(file));
    assert.doesNotMatch(body, /from '\.\/service\.js'|from '\.\/materialization\.js'/, file);
    assert.doesNotMatch(body, /envelope\.js|keys\.js/, `${file} must not depend on secret runtime`);
  }
});
