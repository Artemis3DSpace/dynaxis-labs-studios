import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  buildSecretAad,
  credentialFingerprint,
  openSecret,
  sealSecret,
} from '../lib/dynaxis/secrets/envelope.js';
import {
  DYNAXIS_LOCAL_KEY_ENV_PREFIX,
  createDynaxisKeyManager,
} from '../lib/dynaxis/secrets/keys.js';
import { DYNAXIS_SECRET_ERROR_CODES } from '../lib/dynaxis/secrets/errors.js';
import { PROVIDER_CONNECTION_ERROR_CODES } from '../lib/dynaxis/provider-connections/errors.js';
import {
  PROVIDER_CONNECTION_PERMISSION_NAMES,
  isProviderConnectionPermission,
} from '../lib/dynaxis/provider-connections/permissions.js';
import { authorizeProviderConnection, OWNER_MISMATCH } from '../lib/dynaxis/provider-connections/policy.js';
import {
  PROVIDER_CONNECTION_FORBIDDEN_PUBLIC_FIELDS,
  toPublicProviderConnection,
} from '../lib/dynaxis/provider-connections/redaction.js';
import {
  createMemoryAuditSink,
  createProviderConnectionAuditor,
  scrubAuditProperties,
} from '../lib/dynaxis/provider-connections/audit.js';
import { createProviderConnectionService } from '../lib/dynaxis/provider-connections/service.js';
import {
  materializeProviderCredential,
  useProviderCredential,
} from '../lib/dynaxis/provider-connections/materialization.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG_ID = '88888888-8888-4888-8888-888888888888';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const RAW_SECRET = 'muapi_live_key_SUPER_SECRET_VALUE';

const TEST_KEY_MANAGER = createDynaxisKeyManager({ env: { NODE_ENV: 'test' } });

function humanContext({ userId = USER_ID, workspace = null, project = null } = {}) {
  return {
    principal: {
      type: 'human',
      principalId: `user:${userId}`,
      userId,
      authMethod: 'session',
    },
    workspace,
    project,
  };
}

function workspaceAccess(role = 'owner', organizationId = ORG_ID) {
  return { organizationId, role, isMember: true, isPersonal: false };
}

/** In-memory repository double over the WP-7D-03 shape. */
function createMemoryRepository() {
  const connections = new Map();
  const envelopes = new Map();
  return {
    connections,
    envelopes,
    async insertConnection(values) {
      const row = { ...values };
      connections.set(row.id, row);
      return { ...row };
    },
    async updateConnection(id, patch) {
      const existing = connections.get(id);
      if (!existing) return null;
      const next = { ...existing, ...patch, updatedAt: new Date() };
      connections.set(id, next);
      return { ...next };
    },
    async findConnectionById(id) {
      const row = connections.get(id);
      return row ? { ...row } : null;
    },
    async listConnectionsForWorkspace(organizationId) {
      return [...connections.values()]
        .filter((row) => row.ownerWorkspaceId === organizationId && !row.deletedAt)
        .map((row) => ({ ...row }));
    },
    async listConnectionsForUser(userId) {
      return [...connections.values()]
        .filter((row) => row.ownerUserId === userId && !row.deletedAt)
        .map((row) => ({ ...row }));
    },
    async insertEnvelope(values) {
      const row = { ...values };
      envelopes.set(row.id, row);
      return { ...row };
    },
    async findEnvelopeById(id) {
      const row = envelopes.get(id);
      return row ? { ...row } : null;
    },
    async findLatestEnvelope(connectionId) {
      const rows = [...envelopes.values()]
        .filter((row) => row.connectionId === connectionId)
        .sort((a, b) => b.secretVersion - a.secretVersion);
      return rows[0] ? { ...rows[0] } : null;
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
  const auditor = createProviderConnectionAuditor({ sink });
  const service = createProviderConnectionService({
    repository,
    auditor,
    keyManager: TEST_KEY_MANAGER,
  });
  return { repository, sink, auditor, service };
}

async function createWorkspaceConnection(harness, overrides = {}) {
  return harness.service.create(humanContext({ workspace: workspaceAccess('owner') }), {
    providerId: 'muapi',
    ownerType: 'workspace',
    ownerWorkspaceId: ORG_ID,
    credentialKind: 'api_key',
    secret: RAW_SECRET,
    label: 'Primary MuAPI',
    ...overrides,
  });
}

test('WP-7D-04 create encrypts credential material and persists only envelope references', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);

  const row = [...harness.repository.connections.values()][0];
  const envelope = [...harness.repository.envelopes.values()][0];

  // Metadata row carries references and a fingerprint, never the secret.
  assert.equal(row.secretRef, envelope.id);
  assert.equal(row.secretVersion, 1);
  assert.ok(row.keyRef.startsWith('test://'));
  assert.equal(row.credentialFingerprint, credentialFingerprint(RAW_SECRET));
  assert.equal(row.secretStatus, 'active');
  assert.equal(row.status, 'active');

  const serializedRow = JSON.stringify(row);
  assert.doesNotMatch(serializedRow, new RegExp(RAW_SECRET));
  assert.equal(created.id, row.id);

  // Envelope stores ciphertext, never plaintext.
  const serializedEnvelope = JSON.stringify(envelope);
  assert.doesNotMatch(serializedEnvelope, new RegExp(RAW_SECRET));
  assert.equal(envelope.algorithm, 'aes-256-gcm');
  assert.equal(envelope.aadOwnerType, 'workspace');
  assert.equal(envelope.aadOwnerId, ORG_ID);
  assert.equal(envelope.aadSecretVersion, 1);
});

test('WP-7D-04 unwrap succeeds only with the correct AAD context', async () => {
  const context = { ownerType: 'workspace', ownerId: ORG_ID, providerId: 'muapi', credentialKind: 'api_key', secretVersion: 1 };
  const sealed = await sealSecret({ plaintext: RAW_SECRET, context, keyManager: TEST_KEY_MANAGER });
  const envelope = { ...sealed };

  const opened = await openSecret({ envelope, expectedContext: context, keyManager: TEST_KEY_MANAGER });
  assert.equal(opened, RAW_SECRET);

  assert.equal(
    buildSecretAad(context),
    `workspace:${ORG_ID}:muapi:api_key:1`
  );

  const wrongContexts = [
    { ...context, ownerId: OTHER_ORG_ID, label: 'wrong owner' },
    { ...context, ownerType: 'user', label: 'wrong owner type' },
    { ...context, providerId: 'replicate', label: 'wrong provider' },
    { ...context, credentialKind: 'bearer_token', label: 'wrong credential kind' },
    { ...context, secretVersion: 2, label: 'wrong version (replay after rotation)' },
  ];

  for (const wrong of wrongContexts) {
    await assert.rejects(
      openSecret({ envelope, expectedContext: wrong, keyManager: TEST_KEY_MANAGER }),
      (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.AAD_MISMATCH,
      wrong.label
    );
  }
});

test('WP-7D-04 AAD binding is cryptographic, not just a persisted-column comparison', async () => {
  const context = { ownerType: 'workspace', ownerId: ORG_ID, providerId: 'muapi', credentialKind: 'api_key', secretVersion: 1 };
  const sealed = await sealSecret({ plaintext: RAW_SECRET, context, keyManager: TEST_KEY_MANAGER });

  // An attacker who can rewrite the envelope's persisted aad_* columns can
  // satisfy the cheap string pre-check. The AEAD tag must still reject, or the
  // binding would be advisory rather than enforced.
  const forged = { ...sealed, aadOwnerId: OTHER_ORG_ID };
  await assert.rejects(
    openSecret({
      envelope: forged,
      expectedContext: { ...context, ownerId: OTHER_ORG_ID },
      keyManager: TEST_KEY_MANAGER,
    }),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT
  );

  // A different key cannot open the envelope either.
  const otherKeyManager = createDynaxisKeyManager({
    env: { NODE_ENV: 'development', [DYNAXIS_LOCAL_KEY_ENV_PREFIX]: Buffer.alloc(32, 3).toString('base64') },
  });
  await assert.rejects(
    openSecret({
      envelope: { ...sealed, keyRef: 'local://default' },
      expectedContext: context,
      keyManager: otherKeyManager,
    }),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT
  );
});

test('WP-7D-04 tampered ciphertext fails authenticated decryption', async () => {
  const context = { ownerType: 'user', ownerId: USER_ID, providerId: 'muapi', credentialKind: 'api_key', secretVersion: 1 };
  const sealed = await sealSecret({ plaintext: RAW_SECRET, context, keyManager: TEST_KEY_MANAGER });

  const tampered = { ...sealed, encryptedPayload: Buffer.from('tampered-ciphertext').toString('base64') };
  await assert.rejects(
    openSecret({ envelope: tampered, expectedContext: context, keyManager: TEST_KEY_MANAGER }),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT
  );
});

test('WP-7D-04 permission vocabulary covers the WP-7D-01 operations', () => {
  assert.deepEqual(PROVIDER_CONNECTION_PERMISSION_NAMES, [
    'provider_connection.audit.read',
    'provider_connection.create',
    'provider_connection.delete',
    'provider_connection.read',
    'provider_connection.revoke',
    'provider_connection.rotate',
    'provider_connection.use',
  ]);
  assert.equal(isProviderConnectionPermission('provider_connection.use'), true);
  assert.equal(isProviderConnectionPermission('provider_connection.fly'), false);
});

test('WP-7D-04 legacy and service principals gain no ProviderConnection authority', () => {
  const connection = { id: 'c1', ownerType: 'workspace', ownerWorkspaceId: ORG_ID };
  const principals = [
    { type: 'legacy', legacyOwnerRef: 'ak_sha256:claimed', authMethod: 'legacy-muapi-key' },
    { type: 'service', principalId: 'svc-1', authMethod: 'internal' },
    { type: 'api-key', principalId: 'key-1', authMethod: 'api-key' },
    { type: 'provider-credential', provider: 'muapi', authMethod: 'api-key' },
  ];

  for (const principal of principals) {
    for (const permission of PROVIDER_CONNECTION_PERMISSION_NAMES) {
      const decision = authorizeProviderConnection({
        permission,
        principal,
        workspace: workspaceAccess('owner'),
        connection,
      });
      assert.equal(decision.allowed, false, `${principal.type} ${permission}`);
    }
  }
});

test('WP-7D-04 user-owned connections are same-user credentials and workspace role never substitutes', () => {
  const connection = { id: 'c1', ownerType: 'user', ownerUserId: USER_ID };

  const owner = authorizeProviderConnection({
    permission: 'provider_connection.use',
    principal: humanContext().principal,
    connection,
  });
  assert.equal(owner.allowed, true);

  const otherUserAsWorkspaceOwner = authorizeProviderConnection({
    permission: 'provider_connection.use',
    principal: humanContext({ userId: OTHER_USER_ID }).principal,
    workspace: workspaceAccess('owner'),
    connection,
  });
  assert.equal(otherUserAsWorkspaceOwner.allowed, false);
  assert.equal(otherUserAsWorkspaceOwner.reason, OWNER_MISMATCH);
});

test('WP-7D-04 workspace-owned connections require matching workspace and sufficient role', () => {
  const connection = { id: 'c1', ownerType: 'workspace', ownerWorkspaceId: ORG_ID };

  assert.equal(
    authorizeProviderConnection({
      permission: 'provider_connection.rotate',
      principal: humanContext().principal,
      workspace: workspaceAccess('admin'),
      connection,
    }).allowed,
    true
  );

  // Insufficient role.
  assert.equal(
    authorizeProviderConnection({
      permission: 'provider_connection.rotate',
      principal: humanContext().principal,
      workspace: workspaceAccess('member'),
      connection,
    }).allowed,
    false
  );

  // Cross-workspace attempt.
  const crossWorkspace = authorizeProviderConnection({
    permission: 'provider_connection.read',
    principal: humanContext().principal,
    workspace: workspaceAccess('owner', OTHER_ORG_ID),
    connection,
  });
  assert.equal(crossWorkspace.allowed, false);
  assert.equal(crossWorkspace.reason, OWNER_MISMATCH);

  // Non-member of the active workspace.
  assert.equal(
    authorizeProviderConnection({
      permission: 'provider_connection.read',
      principal: humanContext().principal,
      workspace: { organizationId: ORG_ID, role: 'owner', isMember: false },
      connection,
    }).allowed,
    false
  );
});

test('WP-7D-04 workspace role alone does not grant Project-scoped use', () => {
  const connection = { id: 'c1', ownerType: 'workspace', ownerWorkspaceId: ORG_ID };
  const base = {
    permission: 'provider_connection.use',
    principal: humanContext().principal,
    workspace: workspaceAccess('owner'),
    connection,
    projectScoped: true,
  };

  assert.equal(authorizeProviderConnection(base).allowed, false, 'no project context');
  assert.equal(
    authorizeProviderConnection({
      ...base,
      project: { projectId: PROJECT_ID, isMember: false },
    }).allowed,
    false,
    'not a project member'
  );
  assert.equal(
    authorizeProviderConnection({
      ...base,
      project: { projectId: PROJECT_ID, isMember: true, role: 'viewer' },
    }).allowed,
    false,
    'insufficient project role'
  );
  assert.equal(
    authorizeProviderConnection({
      ...base,
      project: { projectId: PROJECT_ID, isMember: true, role: 'editor' },
    }).allowed,
    true,
    'editor may dispatch'
  );
});

test('WP-7D-04 unauthorized actors cannot read, use, rotate, revoke, or delete', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });

  for (const call of [
    () => harness.service.get(intruder, created.id),
    () => harness.service.rotate(intruder, created.id, { secret: 'new-secret-value' }),
    () => harness.service.revoke(intruder, created.id),
    () => harness.service.remove(intruder, created.id),
    () => harness.service.resolveForUse(intruder, { connectionId: created.id }),
  ]) {
    await assert.rejects(call, (err) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
      ].includes(err.code)
    );
  }
});

test('WP-7D-04 public projection omits secretRef, keyRef, envelope metadata, and plaintext', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const row = [...harness.repository.connections.values()][0];

  const publicShape = toPublicProviderConnection(row);
  const serialized = JSON.stringify(publicShape);

  for (const forbidden of PROVIDER_CONNECTION_FORBIDDEN_PUBLIC_FIELDS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicShape, forbidden),
      false,
      `public projection must not expose ${forbidden}`
    );
  }
  assert.doesNotMatch(serialized, new RegExp(RAW_SECRET));
  assert.doesNotMatch(serialized, /test:\/\//, 'keyRef must not reach the browser');

  // Safe operator-facing metadata is still present.
  assert.equal(publicShape.credentialFingerprint, credentialFingerprint(RAW_SECRET));
  assert.equal(publicShape.status, 'active');
  assert.equal(created.credentialFingerprint, publicShape.credentialFingerprint);
});

test('WP-7D-04 materialization returns plaintext only to the server dispatch boundary', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const context = humanContext({ workspace: workspaceAccess('member') });

  const materialized = await materializeProviderCredential(context, {
    service: harness.service,
    connectionId: created.id,
  });
  assert.equal(materialized.secret, RAW_SECRET);
  assert.equal(materialized.secretVersion, 1);

  // The scoped helper drops the plaintext reference after dispatch.
  let seen = null;
  const result = await useProviderCredential(
    context,
    { service: harness.service, connectionId: created.id },
    async (credential) => {
      seen = credential.secret;
      return 'dispatched';
    }
  );
  assert.equal(result, 'dispatched');
  assert.equal(seen, RAW_SECRET);

  // Audit never contains the secret.
  const auditJson = JSON.stringify(harness.sink.list());
  assert.doesNotMatch(auditJson, new RegExp(RAW_SECRET));
});

test('WP-7D-04 rotation supersedes the previous version and old AAD cannot be replayed', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const admin = humanContext({ workspace: workspaceAccess('admin') });

  const rotatedSecret = 'muapi_live_key_ROTATED_VALUE';
  await harness.service.rotate(admin, created.id, { secret: rotatedSecret });

  const row = [...harness.repository.connections.values()][0];
  assert.equal(row.secretVersion, 2);
  assert.equal(row.credentialFingerprint, credentialFingerprint(rotatedSecret));

  const materialized = await materializeProviderCredential(
    humanContext({ workspace: workspaceAccess('member') }),
    { service: harness.service, connectionId: created.id }
  );
  assert.equal(materialized.secret, rotatedSecret);

  // The superseded v1 envelope cannot be opened under the current v2 context.
  const v1 = [...harness.repository.envelopes.values()].find((e) => e.secretVersion === 1);
  await assert.rejects(
    openSecret({
      envelope: v1,
      expectedContext: {
        ownerType: 'workspace',
        ownerId: ORG_ID,
        providerId: 'muapi',
        credentialKind: 'api_key',
        secretVersion: 2,
      },
      keyManager: TEST_KEY_MANAGER,
    }),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.AAD_MISMATCH
  );
});

test('WP-7D-04 lifecycle states fail closed for use', async () => {
  const cases = [
    ['deleted', { status: 'deleted', deletedAt: new Date() }, PROVIDER_CONNECTION_ERROR_CODES.DELETED],
    ['revoked', { status: 'revoked', revokedAt: new Date() }, PROVIDER_CONNECTION_ERROR_CODES.REVOKED],
    ['rotation_required status', { status: 'rotation_required' }, PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED],
    ['rotation deadline passed', { rotationRequiredAt: new Date(Date.now() - 1000) }, PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED],
    ['rotation in progress', { rotationInProgress: true }, PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED],
    ['disabled', { status: 'disabled' }, PROVIDER_CONNECTION_ERROR_CODES.INACTIVE],
    ['pending verification', { status: 'pending_verification' }, PROVIDER_CONNECTION_ERROR_CODES.INACTIVE],
    ['provider error', { status: 'provider_error' }, PROVIDER_CONNECTION_ERROR_CODES.INACTIVE],
    ['expired', { expiresAt: new Date(Date.now() - 1000) }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_EXPIRED],
    ['corrupted secret', { secretStatus: 'corrupted' }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT],
    ['missing secret', { secretStatus: 'missing' }, PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING],
    ['secret rotation required', { secretStatus: 'rotation_required' }, PROVIDER_CONNECTION_ERROR_CODES.ROTATION_REQUIRED],
  ];

  for (const [label, patch, expectedCode] of cases) {
    const harness = createHarness();
    const created = await createWorkspaceConnection(harness);
    const row = harness.repository.connections.get(created.id);
    Object.assign(row, patch);

    await assert.rejects(
      harness.service.resolveForUse(humanContext({ workspace: workspaceAccess('member') }), {
        connectionId: created.id,
      }),
      (err) => err.code === expectedCode,
      label
    );
  }
});

test('WP-7D-04 missing envelope fails closed and records secretStatus missing', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  harness.repository.envelopes.clear();
  const row = harness.repository.connections.get(created.id);
  row.secretRef = null;

  await assert.rejects(
    materializeProviderCredential(humanContext({ workspace: workspaceAccess('member') }), {
      service: harness.service,
      connectionId: created.id,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING
  );
  assert.equal(harness.repository.connections.get(created.id).secretStatus, 'missing');
});

test('WP-7D-04 corrupted envelope fails closed and marks the connection corrupted', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const envelope = [...harness.repository.envelopes.values()][0];
  harness.repository.envelopes.get(envelope.id).encryptedPayload = Buffer.from('junk').toString('base64');

  await assert.rejects(
    materializeProviderCredential(humanContext({ workspace: workspaceAccess('member') }), {
      service: harness.service,
      connectionId: created.id,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.SECRET_CORRUPT
  );
  assert.equal(harness.repository.connections.get(created.id).secretStatus, 'corrupted');
});

test('WP-7D-04 capability and model constraints deny mismatched dispatch', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness, {
    allowedCapabilities: ['image.generate'],
    allowedProviderModels: ['model-a'],
  });
  const context = humanContext({ workspace: workspaceAccess('member') });

  await assert.rejects(
    materializeProviderCredential(context, {
      service: harness.service,
      connectionId: created.id,
      capabilityId: 'video.generate',
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.CAPABILITY_DENIED
  );
  await assert.rejects(
    materializeProviderCredential(context, {
      service: harness.service,
      connectionId: created.id,
      modelId: 'model-z',
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.MODEL_DENIED
  );
});

test('WP-7D-04 key providers are environment-gated and the KMS boundary fails closed', async () => {
  // Deterministic test keys only in test.
  const prodManager = createDynaxisKeyManager({ env: { NODE_ENV: 'production' } });
  await assert.rejects(
    prodManager.resolveKey('test://aes-256-gcm/default'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_FORBIDDEN_ENVIRONMENT
  );

  // Local dev keys refused in production.
  const prodLocal = createDynaxisKeyManager({
    env: { NODE_ENV: 'production', [DYNAXIS_LOCAL_KEY_ENV_PREFIX]: Buffer.alloc(32, 7).toString('base64') },
  });
  await assert.rejects(
    prodLocal.resolveKey('local://default'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_FORBIDDEN_ENVIRONMENT
  );

  // Local dev key missing -> fail closed, no fallback.
  const devNoKey = createDynaxisKeyManager({ env: { NODE_ENV: 'development' } });
  await assert.rejects(
    devNoKey.resolveKey('local://default'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE
  );
  assert.equal(devNoKey.defaultKeyRef(), null, 'no safe default key in dev without a configured key');

  // Local dev key present -> works, and is at least 256-bit.
  const devWithKey = createDynaxisKeyManager({
    env: { NODE_ENV: 'development', [DYNAXIS_LOCAL_KEY_ENV_PREFIX]: Buffer.alloc(32, 9).toString('base64') },
  });
  assert.equal((await devWithKey.resolveKey('local://default')).length, 32);

  // Short key rejected.
  const shortKey = createDynaxisKeyManager({
    env: { NODE_ENV: 'development', [DYNAXIS_LOCAL_KEY_ENV_PREFIX]: Buffer.alloc(8, 1).toString('base64') },
  });
  await assert.rejects(
    shortKey.resolveKey('local://default'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE
  );

  // Production KMS is an unconfigured boundary that fails closed.
  const kms = createDynaxisKeyManager({ env: { NODE_ENV: 'production' } });
  await assert.rejects(
    kms.resolveKey('kms://us-east-1/dynaxis-secrets/1'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_UNCONFIGURED
  );
  assert.equal(kms.defaultKeyRef(), null, 'production has no implicit key');

  // Unknown provider scheme rejected.
  await assert.rejects(
    kms.resolveKey('file:///etc/keys/master'),
    (err) => err.code === DYNAXIS_SECRET_ERROR_CODES.KEY_REF_INVALID
  );
});

test('WP-7D-04 audit records never carry secret material', async () => {
  const scrubbed = scrubAuditProperties({
    connectionId: 'c1',
    providerId: 'muapi',
    apiKey: RAW_SECRET,
    api_key: RAW_SECRET,
    token: 'bearer-token',
    accessToken: 'at',
    refreshToken: 'rt',
    clientSecret: 'cs',
    serviceAccountJson: '{}',
    webhookSecret: 'whs',
    plaintext: RAW_SECRET,
    encryptedPayload: 'ciphertext',
    authTag: 'tag',
    iv: 'iv',
    aad: 'workspace:x:y:z:1',
    nested: { secret: RAW_SECRET },
    credentialFingerprint: 'sha256:abc',
  });

  assert.deepEqual(Object.keys(scrubbed).sort(), [
    'connectionId',
    'credentialFingerprint',
    'providerId',
  ]);
  assert.doesNotMatch(JSON.stringify(scrubbed), new RegExp(RAW_SECRET));

  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  await harness.service.get(humanContext({ workspace: workspaceAccess('owner') }), created.id);
  const auditJson = JSON.stringify(harness.sink.list());
  assert.doesNotMatch(auditJson, new RegExp(RAW_SECRET));
  assert.doesNotMatch(auditJson, /test:\/\//, 'audit must not record keyRef');
});

test('WP-7D-04 denied attempts are audited without secret material', async () => {
  const harness = createHarness();
  const created = await createWorkspaceConnection(harness);
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });

  await assert.rejects(harness.service.resolveForUse(intruder, { connectionId: created.id }));
  const denied = harness.sink.list().filter((e) => e.event === 'provider_connection.denied');
  assert.ok(denied.length >= 1);
  assert.equal(denied.at(-1).properties.reasonCode, OWNER_MISMATCH);
  assert.doesNotMatch(JSON.stringify(denied), new RegExp(RAW_SECRET));
});

test('WP-7D-04 no_secret_required connections never create or unwrap an envelope', async () => {
  const harness = createHarness();
  const created = await harness.service.create(humanContext({ workspace: workspaceAccess('owner') }), {
    providerId: 'local-private',
    ownerType: 'workspace',
    ownerWorkspaceId: ORG_ID,
    credentialKind: 'no_secret_required',
  });

  assert.equal(harness.repository.envelopes.size, 0);
  const row = harness.repository.connections.get(created.id);
  assert.equal(row.secretRef, undefined);
  assert.equal(row.status, 'pending_verification');

  // Supplying credential material for a secretless kind is rejected.
  await assert.rejects(
    harness.service.create(humanContext({ workspace: workspaceAccess('owner') }), {
      providerId: 'local-private',
      ownerType: 'workspace',
      ownerWorkspaceId: ORG_ID,
      credentialKind: 'no_secret_required',
      secret: RAW_SECRET,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT
  );
});

test('WP-7D-04 revoke and delete preserve tombstone semantics and clear default routing', async () => {
  const harness = createHarness();
  const admin = humanContext({ workspace: workspaceAccess('admin') });

  const revokedTarget = await createWorkspaceConnection(harness);
  const revoked = await harness.service.revoke(admin, revokedTarget.id);
  assert.equal(revoked.status, 'revoked');
  assert.ok(revoked.revokedAt);
  assert.equal(revoked.defaultForWorkspace, false);
  assert.equal(harness.repository.connections.get(revokedTarget.id).revokedByUserId, USER_ID);

  const deleteTarget = await createWorkspaceConnection(harness, { label: 'second' });
  const deleted = await harness.service.remove(admin, deleteTarget.id);
  assert.equal(deleted.status, 'deleted');
  assert.ok(deleted.deletedAt);

  // Rotating a revoked or deleted connection is refused.
  await assert.rejects(
    harness.service.rotate(admin, revokedTarget.id, { secret: 'x'.repeat(20) }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.REVOKED
  );
  await assert.rejects(
    harness.service.rotate(admin, deleteTarget.id, { secret: 'x'.repeat(20) }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.DELETED
  );
});

test('WP-7D-04 list is filtered by authorization and returns redacted rows', async () => {
  const harness = createHarness();
  await createWorkspaceConnection(harness);
  await createWorkspaceConnection(harness, { label: 'second' });

  const owner = humanContext({ workspace: workspaceAccess('viewer') });
  const rows = await harness.service.list(owner, { ownerType: 'workspace', organizationId: ORG_ID });
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'secretRef'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'keyRef'), false);
  }

  // A caller whose active workspace is different sees nothing.
  const outsider = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });
  const none = await harness.service.list(outsider, { ownerType: 'workspace', organizationId: ORG_ID });
  assert.equal(none.length, 0);
});

test('WP-7D-04 adds no OAuth, UI, provider adapter, schema, or migration changes', () => {
  // WP-7D keeps its migration at 0015; later non-7D migrations are allowed.
  const migrations = readdirSync(new URL('drizzle/', ROOT)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(migrations.includes('0015_phase_7d_3_provider_connections.sql'));
  assert.ok(migrations.length >= 16);

  // Schema modules are unchanged in shape: still exactly one schema file each.
  assert.ok(existsSync(new URL('lib/dynaxis/provider-connections/schema.js', ROOT)));
  assert.ok(existsSync(new URL('lib/dynaxis/secrets/schema.js', ROOT)));

  // No OAuth flow, no UI, no provider-specific adapter added by this package.
  assert.equal(existsSync(new URL('lib/dynaxis/provider-connections/oauth.js', ROOT)), false);

  // WP-7D-06 legitimately adds route and Studio surfaces, so asserting their
  // absence is obsolete. The durable invariant is that neither may reach into
  // the secret runtime.
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
    'lib/dynaxis/provider-connections/service.js',
    'lib/dynaxis/provider-connections/materialization.js',
    'lib/dynaxis/provider-connections/policy.js',
    'lib/dynaxis/secrets/envelope.js',
    'lib/dynaxis/secrets/keys.js',
  ]) {
    const body = source(file);
    assert.doesNotMatch(body, /oauth2|authorization_code|redirect_uri/i, `${file} must not implement OAuth`);
    assert.doesNotMatch(body, /useState|jsx|react/i, `${file} must not implement UI`);
    assert.doesNotMatch(body, /pgTable\(/, `${file} must not declare schema`);
  }
});

test('WP-7D-04 provider adapters cannot reach key management or envelope internals', () => {
  const providerFiles = readdirSync(new URL('lib/dynaxis/providers/', ROOT)).filter((f) => f.endsWith('.js'));
  for (const file of providerFiles) {
    const body = source(`lib/dynaxis/providers/${file}`);
    assert.doesNotMatch(body, /secrets\/keys\.js|secrets\/envelope\.js/, `${file} must not import secret internals`);
    assert.doesNotMatch(body, /materializeProviderCredential/, `${file} must not materialize credentials itself`);
  }
});
