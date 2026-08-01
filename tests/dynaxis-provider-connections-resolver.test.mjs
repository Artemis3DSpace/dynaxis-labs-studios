import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createDynaxisKeyManager } from '../lib/dynaxis/secrets/keys.js';
import { PROVIDER_CONNECTION_ERROR_CODES } from '../lib/dynaxis/provider-connections/errors.js';
import {
  createMemoryAuditSink,
  createProviderConnectionAuditor,
} from '../lib/dynaxis/provider-connections/audit.js';
import { createProviderConnectionService } from '../lib/dynaxis/provider-connections/service.js';
import { PROVIDER_CONNECTION_FORBIDDEN_PUBLIC_FIELDS } from '../lib/dynaxis/provider-connections/redaction.js';
import {
  DYNAXIS_MUAPI_PROVIDER_ID,
  assertProviderConnectionCapablePrincipal,
  dispatchWithProviderConnection,
  selectProviderConnection,
  withMuapiCredential,
} from '../lib/dynaxis/provider-connections/resolver.js';
import {
  hasMigratedMuapiConnection,
  importLegacyMuapiCredential,
} from '../lib/dynaxis/provider-connections/muapi-migration.js';
import { MuAPIProvider } from '../lib/dynaxis/providers/muapi.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG_ID = '88888888-8888-4888-8888-888888888888';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const LEGACY_MUAPI_KEY = 'muapi_live_LEGACY_MIGRATED_KEY_VALUE';

const TEST_KEY_MANAGER = createDynaxisKeyManager({ env: { NODE_ENV: 'test' } });

function humanContext({ userId = USER_ID, workspace = null, project = null } = {}) {
  return {
    principal: { type: 'human', principalId: `user:${userId}`, userId, authMethod: 'session' },
    workspace,
    project,
  };
}

function legacyContext(ownerRef = 'ak_sha256:legacy') {
  return {
    subject: { type: 'legacy', legacyOwnerRef: ownerRef, authMethod: 'legacy-muapi-key' },
    principal: { type: 'legacy', legacyOwnerRef: ownerRef, authMethod: 'legacy-muapi-key' },
    workspace: null,
  };
}

function workspaceAccess(role = 'owner', organizationId = ORG_ID) {
  return { organizationId, role, isMember: true, isPersonal: false };
}

function createMemoryRepository() {
  const connections = new Map();
  const envelopes = new Map();
  return {
    connections,
    envelopes,
    async insertConnection(v) { connections.set(v.id, { ...v }); return { ...v }; },
    async updateConnection(id, patch) {
      const existing = connections.get(id);
      if (!existing) return null;
      const next = { ...existing, ...patch, updatedAt: new Date() };
      connections.set(id, next);
      return { ...next };
    },
    async findConnectionById(id) { const r = connections.get(id); return r ? { ...r } : null; },
    async listConnectionsForWorkspace(orgId) {
      return [...connections.values()].filter((r) => r.ownerWorkspaceId === orgId && !r.deletedAt).map((r) => ({ ...r }));
    },
    async listConnectionsForUser(userId) {
      return [...connections.values()].filter((r) => r.ownerUserId === userId && !r.deletedAt).map((r) => ({ ...r }));
    },
    async insertEnvelope(v) { envelopes.set(v.id, { ...v }); return { ...v }; },
    async findEnvelopeById(id) { const r = envelopes.get(id); return r ? { ...r } : null; },
    async findLatestEnvelope(cid) {
      const r = [...envelopes.values()].filter((e) => e.connectionId === cid).sort((a, b) => b.secretVersion - a.secretVersion)[0];
      return r ? { ...r } : null;
    },
    async updateEnvelope(id, patch) {
      const existing = envelopes.get(id);
      if (!existing) return null;
      const next = { ...existing, ...patch };
      envelopes.set(id, next);
      return { ...next };
    },
  };
}

function createHarness() {
  const repository = createMemoryRepository();
  const sink = createMemoryAuditSink();
  const service = createProviderConnectionService({
    repository,
    auditor: createProviderConnectionAuditor({ sink }),
    keyManager: TEST_KEY_MANAGER,
  });
  return { repository, sink, service };
}

async function migrateMuapiKey(harness, overrides = {}) {
  return importLegacyMuapiCredential(humanContext({ workspace: workspaceAccess('owner') }), {
    service: harness.service,
    apiKey: LEGACY_MUAPI_KEY,
    ownerType: 'workspace',
    ownerWorkspaceId: ORG_ID,
    makeDefault: true,
    ...overrides,
  });
}

test('WP-7D-05 legacy MuAPI key migrates into a sealed ProviderConnection with no raw persistence', async () => {
  const harness = createHarness();
  const migrated = await migrateMuapiKey(harness);

  const row = [...harness.repository.connections.values()][0];
  const envelope = [...harness.repository.envelopes.values()][0];

  assert.equal(row.providerId, DYNAXIS_MUAPI_PROVIDER_ID);
  assert.equal(row.credentialKind, 'api_key');
  assert.equal(row.status, 'active');
  assert.equal(row.defaultForWorkspace, true);
  assert.equal(row.secretRef, envelope.id);
  assert.ok(row.credentialFingerprint.startsWith('sha256:'));

  // The raw key exists nowhere except inside the AEAD ciphertext.
  assert.doesNotMatch(JSON.stringify(row), new RegExp(LEGACY_MUAPI_KEY));
  assert.doesNotMatch(JSON.stringify(envelope), new RegExp(LEGACY_MUAPI_KEY));
  assert.doesNotMatch(JSON.stringify(harness.sink.list()), new RegExp(LEGACY_MUAPI_KEY));

  // No legacy identity is derived from the key.
  assert.equal(row.ownerRef, undefined);
  assert.doesNotMatch(JSON.stringify(row), /ak_sha256/);

  // The returned projection is redacted.
  for (const forbidden of PROVIDER_CONNECTION_FORBIDDEN_PUBLIC_FIELDS) {
    assert.equal(Object.prototype.hasOwnProperty.call(migrated, forbidden), false, forbidden);
  }
  assert.doesNotMatch(JSON.stringify(migrated), new RegExp(LEGACY_MUAPI_KEY));
  assert.doesNotMatch(JSON.stringify(migrated), /test:\/\//);
});

test('WP-7D-05 canonical AuthContext resolves MuAPI through ProviderConnection and scopes plaintext to dispatch', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness);
  const context = humanContext({ workspace: workspaceAccess('member') });

  let seenKey = null;
  let seenProvider = null;
  const result = await withMuapiCredential(
    context,
    { service: harness.service, ownerType: 'workspace', organizationId: ORG_ID },
    async ({ apiKey, providerId }) => {
      seenKey = apiKey;
      seenProvider = providerId;
      return 'dispatched';
    }
  );

  assert.equal(result, 'dispatched');
  assert.equal(seenKey, LEGACY_MUAPI_KEY, 'adapter boundary receives plaintext');
  assert.equal(seenProvider, DYNAXIS_MUAPI_PROVIDER_ID);
  assert.doesNotMatch(JSON.stringify(harness.sink.list()), new RegExp(LEGACY_MUAPI_KEY));
});

test('WP-7D-05 explicit connectionId is preferred over default selection', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness); // default
  const explicit = await importLegacyMuapiCredential(
    humanContext({ workspace: workspaceAccess('owner') }),
    {
      service: harness.service,
      apiKey: 'muapi_live_EXPLICIT_KEY',
      ownerType: 'workspace',
      ownerWorkspaceId: ORG_ID,
      label: 'Explicit',
      makeDefault: false,
    }
  );

  const selected = await selectProviderConnection(humanContext({ workspace: workspaceAccess('member') }), {
    service: harness.service,
    providerId: DYNAXIS_MUAPI_PROVIDER_ID,
    connectionId: explicit.id,
    organizationId: ORG_ID,
  });
  assert.equal(selected.id, explicit.id);

  let seen = null;
  await withMuapiCredential(
    humanContext({ workspace: workspaceAccess('member') }),
    { service: harness.service, connectionId: explicit.id, organizationId: ORG_ID },
    async ({ apiKey }) => { seen = apiKey; }
  );
  assert.equal(seen, 'muapi_live_EXPLICIT_KEY');
});

test('WP-7D-05 legacy x-api-key principal gains no ProviderConnection authority', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness);
  const legacy = legacyContext();

  assert.throws(
    () => assertProviderConnectionCapablePrincipal(legacy),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN
  );

  for (const call of [
    () => selectProviderConnection(legacy, { service: harness.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, organizationId: ORG_ID }),
    () => withMuapiCredential(legacy, { service: harness.service, organizationId: ORG_ID }, async () => 'nope'),
    () => importLegacyMuapiCredential(legacy, { service: harness.service, apiKey: LEGACY_MUAPI_KEY, ownerType: 'workspace', ownerWorkspaceId: ORG_ID }),
    () => hasMigratedMuapiConnection(legacy, { service: harness.service, organizationId: ORG_ID }),
  ]) {
    await assert.rejects(call, (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN);
  }

  // A legacy key is never stored as a ProviderConnection credential by this path.
  assert.equal(harness.repository.connections.size, 1, 'no connection created by legacy principal');
});

test('WP-7D-05 service and non-human principals are refused by the resolver', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness);

  for (const principal of [
    { type: 'service', principalId: 'svc-1', authMethod: 'internal' },
    { type: 'api-key', principalId: 'key-1', authMethod: 'api-key' },
    { type: 'provider-credential', provider: 'muapi', authMethod: 'api-key' },
  ]) {
    await assert.rejects(
      withMuapiCredential({ principal }, { service: harness.service, organizationId: ORG_ID }, async () => 'nope'),
      (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      principal.type
    );
  }
});

test('WP-7D-05 missing ProviderConnection fails closed', async () => {
  const harness = createHarness();
  const context = humanContext({ workspace: workspaceAccess('member') });

  await assert.rejects(
    withMuapiCredential(context, { service: harness.service, organizationId: ORG_ID }, async () => 'nope'),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );

  await assert.rejects(
    selectProviderConnection(context, {
      service: harness.service,
      providerId: DYNAXIS_MUAPI_PROVIDER_ID,
      connectionId: '44444444-4444-4444-8444-444444444444',
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
});

test('WP-7D-05 providerId mismatch fails closed', async () => {
  const harness = createHarness();
  const replicate = await harness.service.create(humanContext({ workspace: workspaceAccess('owner') }), {
    providerId: 'replicate',
    ownerType: 'workspace',
    ownerWorkspaceId: ORG_ID,
    credentialKind: 'api_key',
    secret: 'replicate_key_value',
  });

  // Asking for MuAPI must never be served by a Replicate connection.
  await assert.rejects(
    selectProviderConnection(humanContext({ workspace: workspaceAccess('member') }), {
      service: harness.service,
      providerId: DYNAXIS_MUAPI_PROVIDER_ID,
      connectionId: replicate.id,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.UNSUPPORTED_PROVIDER
  );

  // And default selection ignores other providers entirely.
  await assert.rejects(
    withMuapiCredential(
      humanContext({ workspace: workspaceAccess('member') }),
      { service: harness.service, organizationId: ORG_ID },
      async () => 'nope'
    ),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
});

test('WP-7D-05 unauthorized actors cannot resolve or dispatch', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness);
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });

  const row = [...harness.repository.connections.values()][0];
  await assert.rejects(
    withMuapiCredential(
      intruder,
      { service: harness.service, connectionId: row.id, organizationId: OTHER_ORG_ID },
      async () => 'nope'
    ),
    (err) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
      ].includes(err.code)
  );
});

test('WP-7D-05 selection alone cannot disclose another owner ProviderConnection', async () => {
  const harness = createHarness();
  const victim = await migrateMuapiKey(harness);
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });

  // Selection returns persisted rows carrying secretRef/keyRef, so it must gate
  // on provider_connection.read rather than deferring to materialization.
  // Passing a foreign organizationId must not confirm a connection exists.
  await assert.rejects(
    selectProviderConnection(intruder, {
      service: harness.service,
      providerId: DYNAXIS_MUAPI_PROVIDER_ID,
      organizationId: ORG_ID,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );

  // A foreign connectionId must be refused rather than returned.
  await assert.rejects(
    selectProviderConnection(intruder, {
      service: harness.service,
      providerId: DYNAXIS_MUAPI_PROVIDER_ID,
      connectionId: victim.id,
    }),
    (err) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      ].includes(err.code)
  );

  // The owner is unaffected.
  const owner = humanContext({ workspace: workspaceAccess('viewer') });
  const selected = await selectProviderConnection(owner, {
    service: harness.service,
    providerId: DYNAXIS_MUAPI_PROVIDER_ID,
    organizationId: ORG_ID,
  });
  assert.equal(selected.id, victim.id);
});

test('WP-7D-05 lifecycle states fail closed through the resolver', async () => {
  const cases = [
    ['disabled', { status: 'disabled' }, PROVIDER_CONNECTION_ERROR_CODES.INACTIVE],
    ['pending', { status: 'pending_verification' }, PROVIDER_CONNECTION_ERROR_CODES.INACTIVE],
    ['revoked', { status: 'revoked', revokedAt: new Date() }, PROVIDER_CONNECTION_ERROR_CODES.REVOKED],
    ['deleted', { status: 'deleted', deletedAt: new Date() }, PROVIDER_CONNECTION_ERROR_CODES.DELETED],
    ['rotation required', { status: 'rotation_required' }, PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED],
    ['secret missing', { secretStatus: 'missing' }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING],
    ['secret corrupted', { secretStatus: 'corrupted' }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT],
    ['expired', { expiresAt: new Date(Date.now() - 1000) }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_EXPIRED],
  ];

  for (const [label, patch, expectedCode] of cases) {
    const harness = createHarness();
    const migrated = await migrateMuapiKey(harness);
    Object.assign(harness.repository.connections.get(migrated.id), patch);

    await assert.rejects(
      withMuapiCredential(
        humanContext({ workspace: workspaceAccess('member') }),
        { service: harness.service, connectionId: migrated.id, organizationId: ORG_ID },
        async () => 'nope'
      ),
      (err) => err.code === expectedCode,
      label
    );
  }
});

test('WP-7D-05 key unavailable and corrupted envelope fail closed without plaintext', async () => {
  // Key provider refuses outside its environment -> SECRET_UNAVAILABLE.
  const harness = createHarness();
  const migrated = await migrateMuapiKey(harness);
  harness.service.keyManager = createDynaxisKeyManager({ env: { NODE_ENV: 'production' } });

  let leaked = null;
  await assert.rejects(
    withMuapiCredential(
      humanContext({ workspace: workspaceAccess('member') }),
      { service: harness.service, connectionId: migrated.id, organizationId: ORG_ID },
      async ({ apiKey }) => { leaked = apiKey; return 'nope'; }
    ),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.SECRET_UNAVAILABLE
  );
  assert.equal(leaked, null, 'dispatch callback must not run on key failure');

  // Corrupted ciphertext -> SECRET_CORRUPT, dispatch never runs.
  const corrupt = createHarness();
  const corruptMigrated = await migrateMuapiKey(corrupt);
  const envelope = [...corrupt.repository.envelopes.values()][0];
  corrupt.repository.envelopes.get(envelope.id).encryptedPayload = Buffer.from('junk').toString('base64');

  let leaked2 = null;
  await assert.rejects(
    withMuapiCredential(
      humanContext({ workspace: workspaceAccess('member') }),
      { service: corrupt.service, connectionId: corruptMigrated.id, organizationId: ORG_ID },
      async ({ apiKey }) => { leaked2 = apiKey; return 'nope'; }
    ),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT
  );
  assert.equal(leaked2, null, 'dispatch callback must not run on corrupt envelope');
});

test('WP-7D-05 capability and model restrictions are enforced by the resolver path', async () => {
  const harness = createHarness();
  const migrated = await migrateMuapiKey(harness, { makeDefault: true });
  Object.assign(harness.repository.connections.get(migrated.id), {
    allowedCapabilities: ['image.generate'],
    allowedProviderModels: ['model-a'],
  });
  const context = humanContext({ workspace: workspaceAccess('member') });

  await assert.rejects(
    withMuapiCredential(context, { service: harness.service, organizationId: ORG_ID, capabilityId: 'video.generate' }, async () => 'nope'),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.CAPABILITY_DENIED
  );
  await assert.rejects(
    withMuapiCredential(context, { service: harness.service, organizationId: ORG_ID, modelId: 'model-z' }, async () => 'nope'),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.MODEL_DENIED
  );

  // Allowed capability + model still dispatches.
  let ok = false;
  await withMuapiCredential(
    context,
    { service: harness.service, organizationId: ORG_ID, capabilityId: 'image.generate', modelId: 'model-a' },
    async () => { ok = true; }
  );
  assert.equal(ok, true);
});

test('WP-7D-05 workspace role alone does not grant Project-scoped MuAPI dispatch', async () => {
  const harness = createHarness();
  const migrated = await migrateMuapiKey(harness);

  await assert.rejects(
    withMuapiCredential(
      humanContext({ workspace: workspaceAccess('owner'), project: { projectId: PROJECT_ID, isMember: true, role: 'viewer' } }),
      { service: harness.service, connectionId: migrated.id, organizationId: ORG_ID, projectScoped: true },
      async () => 'nope'
    ),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN
  );

  let ok = false;
  await withMuapiCredential(
    humanContext({ workspace: workspaceAccess('owner'), project: { projectId: PROJECT_ID, isMember: true, role: 'editor' } }),
    { service: harness.service, connectionId: migrated.id, organizationId: ORG_ID, projectScoped: true },
    async () => { ok = true; }
  );
  assert.equal(ok, true, 'editor may dispatch Project-scoped');
});

test('WP-7D-05 resolved credential drives the MuAPI adapter without the adapter touching secrets', async () => {
  const harness = createHarness();
  await migrateMuapiKey(harness);

  const calls = [];
  const provider = new MuAPIProvider({
    apiHost: 'https://api.muapi.test',
    fetchImpl: async (url, init) => {
      calls.push({ url, apiKey: init.headers['x-api-key'] });
      return { ok: true, status: 200, text: async () => JSON.stringify({ request_id: 'req-1' }) };
    },
  });

  const submitted = await withMuapiCredential(
    humanContext({ workspace: workspaceAccess('member') }),
    { service: harness.service, organizationId: ORG_ID },
    async ({ apiKey }) => provider.submit({ apiKey, endpoint: 'predictions', payload: { prompt: 'x' } })
  );

  assert.equal(submitted.providerJobId, 'req-1');
  assert.equal(calls[0].apiKey, LEGACY_MUAPI_KEY, 'adapter received the materialized credential');
  assert.doesNotMatch(JSON.stringify(harness.sink.list()), new RegExp(LEGACY_MUAPI_KEY));
});

test('WP-7D-05 migration detection never compares raw key material', async () => {
  const harness = createHarness();
  const context = humanContext({ workspace: workspaceAccess('owner') });

  assert.equal(
    await hasMigratedMuapiConnection(context, { service: harness.service, organizationId: ORG_ID }),
    false
  );
  await migrateMuapiKey(harness);
  assert.equal(
    await hasMigratedMuapiConnection(context, { service: harness.service, organizationId: ORG_ID }),
    true
  );

  // The detection helper accepts no credential material: its parameter list
  // mentions neither apiKey nor secret, so there is nothing to compare against.
  const migrationSource = source('lib/dynaxis/provider-connections/muapi-migration.js');
  const signature = migrationSource.match(
    /export async function hasMigratedMuapiConnection\(([\s\S]*?)\)\s*\{/
  );
  assert.ok(signature, 'hasMigratedMuapiConnection signature should be findable');
  assert.doesNotMatch(signature[1], /apiKey|secret|credential/i, signature[1]);

  assert.doesNotMatch(
    migrationSource,
    /credentialFingerprint\s*\(/,
    'migration must not fingerprint-compare raw keys'
  );
});

test('WP-7D-05 provider adapters never import secret or key-management internals', () => {
  const providerFiles = readdirSync(new URL('lib/dynaxis/providers/', ROOT)).filter((f) => f.endsWith('.js'));
  for (const file of providerFiles) {
    const body = source(`lib/dynaxis/providers/${file}`);
    assert.doesNotMatch(body, /secrets\/keys\.js|secrets\/envelope\.js/, `${file} must not import secret internals`);
    assert.doesNotMatch(body, /materializeProviderCredential|useProviderCredential/, `${file} must not materialize credentials`);
    assert.doesNotMatch(body, /provider-connections\//, `${file} must stay a pure adapter`);
  }
});

test('WP-7D-05 resolver uses the materialization boundary, not envelope or key internals', () => {
  for (const file of [
    'lib/dynaxis/provider-connections/resolver.js',
    'lib/dynaxis/provider-connections/muapi-migration.js',
  ]) {
    const body = source(file);
    assert.doesNotMatch(body, /from '\.\.\/secrets\/envelope\.js'/, `${file} must not open envelopes directly`);
    assert.doesNotMatch(body, /from '\.\.\/secrets\/keys\.js'/, `${file} must not resolve keys directly`);
    assert.doesNotMatch(body, /openSecret|sealSecret|resolveKey/, `${file} must not call secret primitives`);
  }
  assert.match(
    source('lib/dynaxis/provider-connections/resolver.js'),
    /useProviderCredential/,
    'resolver must go through the WP-7D-04 materialization boundary'
  );
});

test('WP-7D-05 adds no OAuth, UI, schema, or migration', () => {
  const migrations = readdirSync(new URL('drizzle/', ROOT)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0015_phase_7d_3_provider_connections.sql');
  assert.equal(migrations.length, 16);

  assert.equal(existsSync(new URL('lib/dynaxis/provider-connections/oauth.js', ROOT)), false);

  // WP-7D-06 adds the route and Studio surfaces; their absence is no longer
  // the invariant. What must hold is that they never reach the secret runtime.
  for (const surface of [
    'app/api/dynaxis/provider-connections/route.js',
    'packages/studio/src/provider-connections/api.js',
  ]) {
    if (existsSync(new URL(surface, ROOT))) {
      assert.doesNotMatch(
        source(surface),
        /secrets\/(keys|envelope)\.js|openSecret|sealSecret|resolveKey/,
        `${surface} must not reach the secret runtime`
      );
    }
  }

  for (const file of [
    'lib/dynaxis/provider-connections/resolver.js',
    'lib/dynaxis/provider-connections/muapi-migration.js',
  ]) {
    const body = source(file);
    assert.doesNotMatch(body, /oauth2|authorization_code|redirect_uri|refreshAccessToken/i, `${file} must not implement OAuth`);
    assert.doesNotMatch(body, /useState|jsx|react/i, `${file} must not implement UI`);
    assert.doesNotMatch(body, /pgTable\(/, `${file} must not declare schema`);
  }
});
