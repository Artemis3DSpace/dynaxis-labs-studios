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
import {
  PROVIDER_CONNECTION_HEALTH,
  PROVIDER_CONNECTION_HEALTH_VALUES,
  classifyConnectionHealth,
  getConnectionHealth,
  isUsableHealth,
  listConnectionHealth,
  toPublicConnectionHealth,
} from '../lib/dynaxis/provider-connections/health.js';
import {
  readProviderConnectionAudit,
  toPublicAuditEvent,
} from '../lib/dynaxis/provider-connections/audit-view.js';
import {
  FORBIDDEN_CLIENT_FIELDS,
  ProviderConnectionResponseError,
  assertNoForbiddenFields,
} from '../packages/studio/src/provider-connections/api.js';
import {
  canDelete,
  canRevoke,
  canRotate,
  describeConnectionHealth,
  summarizeConnectionHealth,
} from '../packages/studio/src/provider-connections/health-display.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function assertProviderConnectionMigrationOwnership() {
  const providerMigration = '0015_phase_7d_3_provider_connections.sql';
  const migrations = readdirSync(new URL('drizzle/', ROOT)).filter((f) => f.endsWith('.sql')).sort();
  const providerTableNames = ['dynaxis_provider_connections', 'dynaxis_provider_secret_envelopes'];

  assert.ok(migrations.includes(providerMigration), 'provider migration 0015 must exist');
  for (const tableName of providerTableNames) {
    const owners = migrations.filter((file) => source(`drizzle/${file}`).includes(tableName));
    assert.deepEqual(
      owners,
      [providerMigration],
      `${tableName} must only appear in ${providerMigration}`
    );
  }
}

/**
 * Strips block comments and whole-line `//` comments so source assertions scan
 * code rather than documentation. These modules deliberately *describe* the
 * boundary they must not cross ("no envelope state", "`sealSecret` remains
 * importable only by the service"), and describing it is not doing it.
 */
function codeWithoutComments(body) {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG_ID = '88888888-8888-4888-8888-888888888888';
const RAW_SECRET = 'muapi_live_CONSOLE_SECRET_VALUE';

const TEST_KEY_MANAGER = createDynaxisKeyManager({ env: { NODE_ENV: 'test' } });

/** Every field the browser must never receive, in both casings. */
const FORBIDDEN_RESPONSE_FIELDS = Object.freeze([
  'secretRef', 'secret_ref', 'keyRef', 'key_ref', 'secretVersion', 'secret_version',
  'secretStatus', 'secret_status', 'envelopeId', 'envelopeCreatedAt', 'envelope_created_at',
  'encryptedPayload', 'encrypted_payload', 'ciphertext', 'authTag', 'auth_tag', 'iv',
  'aad', 'aadOwnerType', 'aadOwnerId', 'aadProviderId', 'aadCredentialKind', 'aadSecretVersion',
  'plaintext', 'secret', 'apiKey', 'accessToken', 'refreshToken', 'clientSecret',
  'serviceAccountJson', 'webhookSecret', 'rotationInProgress',
]);

function assertRedacted(value, label) {
  const seen = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      if (FORBIDDEN_RESPONSE_FIELDS.includes(key)) seen.push(key);
    }
    Object.values(node).forEach(walk);
  };
  walk(value);
  assert.deepEqual(seen, [], `${label} exposed forbidden fields: ${seen.join(', ')}`);
}

function humanContext({ userId = USER_ID, workspace = null } = {}) {
  return {
    principal: { type: 'human', principalId: `user:${userId}`, userId, authMethod: 'session' },
    workspace,
  };
}

function legacyContext() {
  return {
    subject: { type: 'legacy', legacyOwnerRef: 'ak_sha256:legacy', authMethod: 'legacy-muapi-key' },
    principal: { type: 'legacy', legacyOwnerRef: 'ak_sha256:legacy', authMethod: 'legacy-muapi-key' },
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
      const e = connections.get(id);
      if (!e) return null;
      const n = { ...e, ...patch, updatedAt: new Date() };
      connections.set(id, n);
      return { ...n };
    },
    async findConnectionById(id) { const r = connections.get(id); return r ? { ...r } : null; },
    async listConnectionsForWorkspace(o) {
      return [...connections.values()].filter((r) => r.ownerWorkspaceId === o).map((r) => ({ ...r }));
    },
    async listConnectionsForUser(u) {
      return [...connections.values()].filter((r) => r.ownerUserId === u).map((r) => ({ ...r }));
    },
    async insertEnvelope(v) { envelopes.set(v.id, { ...v }); return { ...v }; },
    async findEnvelopeById(id) { const r = envelopes.get(id); return r ? { ...r } : null; },
    async findLatestEnvelope(cid) {
      const r = [...envelopes.values()].filter((e) => e.connectionId === cid)
        .sort((a, b) => b.secretVersion - a.secretVersion)[0];
      return r ? { ...r } : null;
    },
    async updateEnvelope(id, patch) {
      const e = envelopes.get(id);
      if (!e) return null;
      const n = { ...e, ...patch };
      envelopes.set(id, n);
      return { ...n };
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

async function seedConnection(harness, overrides = {}) {
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

test('WP-7D-06 health classification covers the safe UI vocabulary in severity order', () => {
  const now = new Date('2026-07-01T00:00:00Z');
  const base = { status: 'active', secretStatus: 'active' };
  const cases = [
    [{ ...base, status: 'deleted', deletedAt: now }, PROVIDER_CONNECTION_HEALTH.DELETED],
    [{ ...base, status: 'revoked', revokedAt: now }, PROVIDER_CONNECTION_HEALTH.REVOKED],
    [{ ...base, secretStatus: 'corrupted' }, PROVIDER_CONNECTION_HEALTH.SECRET_CORRUPTED],
    [{ ...base, secretStatus: 'missing' }, PROVIDER_CONNECTION_HEALTH.SECRET_MISSING],
    [{ ...base, status: 'rotation_required' }, PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED],
    [{ ...base, rotationInProgress: true }, PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED],
    [{ ...base, rotationRequiredAt: new Date('2026-06-01T00:00:00Z') }, PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED],
    [{ ...base, expiresAt: new Date('2026-06-01T00:00:00Z') }, PROVIDER_CONNECTION_HEALTH.EXPIRED],
    [{ ...base, status: 'provider_error' }, PROVIDER_CONNECTION_HEALTH.PROVIDER_ERROR],
    [{ ...base, status: 'disabled' }, PROVIDER_CONNECTION_HEALTH.DISABLED],
    [{ ...base, status: 'pending_verification' }, PROVIDER_CONNECTION_HEALTH.PENDING],
    [{ ...base, rotationRequiredAt: new Date('2026-07-03T00:00:00Z') }, PROVIDER_CONNECTION_HEALTH.ROTATION_DUE_SOON],
    [{ ...base }, PROVIDER_CONNECTION_HEALTH.HEALTHY],
    [null, PROVIDER_CONNECTION_HEALTH.UNKNOWN],
  ];
  for (const [row, expected] of cases) {
    assert.equal(classifyConnectionHealth(row, { at: now }), expected, JSON.stringify(row));
  }

  // Only `healthy` and `rotation_due_soon` are usable.
  const usable = PROVIDER_CONNECTION_HEALTH_VALUES.filter((h) => isUsableHealth(h));
  assert.deepEqual(usable.sort(), ['healthy', 'rotation_due_soon']);
});

test('WP-7D-06 health projection is allowlist-based against an adversarial row', () => {
  // Inject every forbidden field directly onto the persisted row.
  const hostile = {
    id: 'c1', providerId: 'muapi', ownerType: 'workspace', ownerWorkspaceId: ORG_ID,
    status: 'active', secretStatus: 'active', credentialFingerprint: 'sha256:abc',
    secretRef: 'ENVELOPE-ID', keyRef: 'kms://prod/alias/9', secretVersion: 42,
    envelopeCreatedAt: '2026-01-01', rotationInProgress: true,
    encryptedPayload: 'CIPHERTEXT', authTag: 'TAG', iv: 'IV', aad: 'workspace:o:p:k:1',
    aadOwnerId: ORG_ID, aadProviderId: 'muapi', plaintext: RAW_SECRET, secret: RAW_SECRET,
    apiKey: RAW_SECRET, accessToken: 'AT', refreshToken: 'RT', clientSecret: 'CS',
    serviceAccountJson: '{}', webhookSecret: 'WHS',
  };

  const projected = toPublicConnectionHealth(hostile);
  assertRedacted(projected, 'health projection');
  const serialized = JSON.stringify(projected);
  for (const forbidden of ['ENVELOPE-ID', 'kms://', 'CIPHERTEXT', 'TAG', RAW_SECRET, 'AT', 'RT', 'CS', 'WHS']) {
    assert.ok(!serialized.includes(forbidden), `leaked ${forbidden}`);
  }
  // The hostile row carries `rotationInProgress: true`. Classification *uses*
  // that server-only field, which is exactly why it must not be echoed back:
  // the caller learns the safe label, not the underlying state.
  assert.equal(projected.health, PROVIDER_CONNECTION_HEALTH.ROTATION_REQUIRED);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'rotationInProgress'), false);
  assert.equal(projected.credentialFingerprint, 'sha256:abc');
  assert.equal(Object.isFrozen(projected), true);

  // Exactly this allowlist, nothing more.
  assert.deepEqual(Object.keys(projected).sort(), [
    'credentialFingerprint', 'health', 'id', 'ownerType', 'ownerWorkspaceId',
    'providerId', 'status', 'usable',
  ]);
});

test('WP-7D-06 list and detail health responses are redacted', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  const owner = humanContext({ workspace: workspaceAccess('viewer') });

  const list = await listConnectionHealth(owner, { service: harness.service, organizationId: ORG_ID });
  assert.equal(list.length, 1);
  assertRedacted(list, 'health list');
  assert.ok(!JSON.stringify(list).includes(RAW_SECRET));
  assert.ok(!JSON.stringify(list).includes('test://'));

  const detail = await getConnectionHealth(owner, { service: harness.service, connectionId: created.id });
  assertRedacted(detail, 'health detail');
  assert.equal(detail.id, created.id);
  assert.equal(detail.health, PROVIDER_CONNECTION_HEALTH.HEALTHY);
});

test('WP-7D-06 foreign owner cannot list or view connection health', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });

  // Spoofing organizationId yields an empty list, not an existence hint.
  const list = await listConnectionHealth(intruder, { service: harness.service, organizationId: ORG_ID });
  assert.deepEqual(list, []);

  await assert.rejects(
    getConnectionHealth(intruder, { service: harness.service, connectionId: created.id }),
    // WP-7D-07 aligned this browser-facing surface to NOT_FOUND so "missing"
    // and "not yours" are indistinguishable. Ownership is still enforced; only
    // the enumeration oracle is removed.
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
});

test('WP-7D-06 legacy x-api-key gains no health, rotation, revoke, delete, or audit authority', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  const legacy = legacyContext();

  const list = await listConnectionHealth(legacy, { service: harness.service, organizationId: ORG_ID });
  assert.deepEqual(list, [], 'legacy principal sees nothing');

  for (const call of [
    () => getConnectionHealth(legacy, { service: harness.service, connectionId: created.id }),
    () => harness.service.rotate(legacy, created.id, { secret: 'x'.repeat(24) }),
    () => harness.service.revoke(legacy, created.id),
    () => harness.service.remove(legacy, created.id),
    () => readProviderConnectionAudit(legacy, { service: harness.service, connectionId: created.id }),
  ]) {
    await assert.rejects(call, (err) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
        // getConnectionHealth reports NOT_FOUND since WP-7D-07 (anti-enumeration).
        PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
      ].includes(err.code)
    );
  }
});

test('WP-7D-06 rotation seals the new credential and never returns or audits plaintext', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  const admin = humanContext({ workspace: workspaceAccess('admin') });
  const NEW_SECRET = 'muapi_live_ROTATED_CONSOLE_VALUE';

  const rotated = await harness.service.rotate(admin, created.id, { secret: NEW_SECRET });

  assertRedacted(rotated, 'rotation response');
  assert.ok(!JSON.stringify(rotated).includes(NEW_SECRET));
  assert.ok(!JSON.stringify(rotated).includes(RAW_SECRET));

  const row = harness.repository.connections.get(created.id);
  assert.equal(row.secretVersion, 2);
  assert.ok(!JSON.stringify(row).includes(NEW_SECRET), 'metadata row must not hold plaintext');
  assert.ok(!JSON.stringify([...harness.repository.envelopes.values()]).includes(NEW_SECRET));
  assert.ok(!JSON.stringify(harness.sink.list()).includes(NEW_SECRET), 'audit must not hold plaintext');
});

test('WP-7D-06 rotation, revoke, and delete require their own permissions', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  // `member` is below the owner/admin threshold for all three operations.
  const member = humanContext({ workspace: workspaceAccess('member') });

  for (const call of [
    () => harness.service.rotate(member, created.id, { secret: 'y'.repeat(24) }),
    () => harness.service.revoke(member, created.id),
    () => harness.service.remove(member, created.id),
  ]) {
    await assert.rejects(call, (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN);
  }

  // A viewer may still read health.
  const viewer = humanContext({ workspace: workspaceAccess('viewer') });
  const detail = await getConnectionHealth(viewer, { service: harness.service, connectionId: created.id });
  assert.equal(detail.id, created.id);
});

test('WP-7D-06 revoked and deleted connections surface safely and become unusable', async () => {
  const harness = createHarness();
  const admin = humanContext({ workspace: workspaceAccess('admin') });

  const toRevoke = await seedConnection(harness);
  const revoked = await harness.service.revoke(admin, toRevoke.id);
  assertRedacted(revoked, 'revoke response');
  const revokedHealth = await getConnectionHealth(admin, { service: harness.service, connectionId: toRevoke.id });
  assert.equal(revokedHealth.health, PROVIDER_CONNECTION_HEALTH.REVOKED);
  assert.equal(revokedHealth.usable, false);

  const toDelete = await seedConnection(harness, { label: 'second' });
  const deleted = await harness.service.remove(admin, toDelete.id);
  assertRedacted(deleted, 'delete response');
  const deletedRow = harness.repository.connections.get(toDelete.id);
  assert.equal(classifyConnectionHealth(deletedRow), PROVIDER_CONNECTION_HEALTH.DELETED);

  // Neither can be used for dispatch.
  for (const id of [toRevoke.id, toDelete.id]) {
    await assert.rejects(
      harness.service.resolveForUse(humanContext({ workspace: workspaceAccess('member') }), { connectionId: id }),
      (err) =>
        [
          PROVIDER_CONNECTION_ERROR_CODES.REVOKED,
          PROVIDER_CONNECTION_ERROR_CODES.DELETED,
        ].includes(err.code)
    );
  }
});

test('WP-7D-06 audit view re-scrubs events and rejects unauthorized readers', async () => {
  const harness = createHarness();
  const created = await seedConnection(harness);
  const admin = humanContext({ workspace: workspaceAccess('admin') });

  // Adversarial: push a hostile record straight into the sink, bypassing the
  // write-time scrubber, to prove the read path re-projects.
  await harness.sink.write({
    event: 'provider_connection.tampered',
    occurredAt: new Date().toISOString(),
    properties: {
      connectionId: created.id,
      providerId: 'muapi',
      apiKey: RAW_SECRET,
      plaintext: RAW_SECRET,
      keyRef: 'kms://prod/alias/1',
      encryptedPayload: 'CIPHERTEXT',
      authTag: 'TAG',
      iv: 'IV',
      aad: 'workspace:o:p:k:1',
      correlationId: 'corr-1',
    },
  });

  const events = await readProviderConnectionAudit(admin, {
    service: harness.service,
    connectionId: created.id,
  });
  assert.ok(events.length >= 1);
  assertRedacted(events, 'audit events');
  const serialized = JSON.stringify(events);
  for (const forbidden of [RAW_SECRET, 'kms://', 'CIPHERTEXT', 'TAG']) {
    assert.ok(!serialized.includes(forbidden), `audit leaked ${forbidden}`);
  }
  // Correlation ids are safe by policy and preserved.
  assert.ok(serialized.includes('corr-1'));

  // Unauthorized readers are refused.
  const intruder = humanContext({ userId: OTHER_USER_ID, workspace: workspaceAccess('owner', OTHER_ORG_ID) });
  await assert.rejects(
    readProviderConnectionAudit(intruder, { service: harness.service, connectionId: created.id }),
    (err) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
      ].includes(err.code)
  );

  // A workspace member without admin cannot read audit either.
  await assert.rejects(
    readProviderConnectionAudit(humanContext({ workspace: workspaceAccess('member') }), {
      service: harness.service,
      connectionId: created.id,
    }),
    (err) => err.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN
  );
});

test('WP-7D-06 audit event projection drops nested and unknown structures', () => {
  const projected = toPublicAuditEvent({
    event: 'provider_connection.use.succeeded',
    occurredAt: '2026-07-01T00:00:00Z',
    internalSink: { path: '/var/log/secret' },
    properties: { connectionId: 'c1', apiKey: RAW_SECRET, nested: { secret: RAW_SECRET }, correlationId: 'x' },
  });
  assert.deepEqual(Object.keys(projected).sort(), ['event', 'occurredAt', 'properties']);
  assert.deepEqual(Object.keys(projected.properties).sort(), ['connectionId', 'correlationId']);
  assert.ok(!JSON.stringify(projected).includes(RAW_SECRET));
});

test('WP-7D-06 seam: a real server audit event passes the Studio client guard', () => {
  // Shaped exactly as the server emits for a rotation: this is the event that
  // previously tripped the client guard and made the audit view unusable.
  const serverEvent = toPublicAuditEvent({
    event: 'provider_connection.rotated',
    occurredAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    properties: {
      connectionId: 'c1',
      providerId: 'muapi',
      secretVersion: 3,
      credentialFingerprint: 'sha256:abc123456789',
      correlationId: 'corr-1',
    },
  });

  // The client guard must accept it without throwing.
  assert.doesNotThrow(() => assertNoForbiddenFields([serverEvent]));

  // Key-management and envelope state are stripped.
  assert.equal(Object.prototype.hasOwnProperty.call(serverEvent.properties, 'secretVersion'), false);
  for (const forbidden of ['secretRef', 'keyRef', 'iv', 'authTag', 'aad', 'encryptedPayload', 'ciphertext', 'plaintext', 'apiKey']) {
    assert.equal(Object.prototype.hasOwnProperty.call(serverEvent.properties, forbidden), false, forbidden);
  }

  // Safe audit fields survive.
  assert.equal(serverEvent.event, 'provider_connection.rotated');
  assert.equal(serverEvent.occurredAt, '2026-08-01T00:00:00Z');
  assert.equal(serverEvent.properties.connectionId, 'c1');
  assert.equal(serverEvent.properties.providerId, 'muapi');
  assert.equal(serverEvent.properties.credentialFingerprint, 'sha256:abc123456789');
  assert.equal(serverEvent.properties.correlationId, 'corr-1');

  // A secret-status transition event is the same bug class and must also pass.
  const statusEvent = toPublicAuditEvent({
    event: 'provider_connection.secret_status.changed',
    occurredAt: '2026-08-01T00:00:00Z',
    properties: { connectionId: 'c1', providerId: 'muapi', previousSecretStatus: 'active', secretStatus: 'corrupted', correlationId: 'corr-2' },
  });
  assert.doesNotThrow(() => assertNoForbiddenFields([statusEvent]));
  assert.equal(Object.prototype.hasOwnProperty.call(statusEvent.properties, 'secretStatus'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(statusEvent.properties, 'previousSecretStatus'), false);
});

test('WP-7D-06 seam invariant: nothing the audit projection can emit collides with the client guard', () => {
  // Systematic rather than field-by-field: feed every property the WP-7D-04
  // audit allowlist is capable of emitting through the public projection, and
  // assert the survivors are all acceptable to the client. This is what
  // catches the bug class if either allowlist drifts.
  const everyServerProperty = {
    connectionId: 'c1', providerId: 'muapi', ownerType: 'workspace',
    ownerUserId: USER_ID, ownerWorkspaceId: ORG_ID, credentialKind: 'api_key',
    credentialFingerprint: 'sha256:abc', status: 'active', secretStatus: 'active',
    previousSecretStatus: 'active', secretVersion: 2, reasonCode: 'ALLOW',
    errorCode: 'NONE', permission: 'provider_connection.use', projectId: 'p1',
    workspaceId: ORG_ID, correlationId: 'corr', actorUserId: USER_ID,
    outcome: 'ok', algorithm: 'aes-256-gcm', count: 1,
  };
  const projected = toPublicAuditEvent({
    event: 'provider_connection.use.succeeded',
    occurredAt: '2026-08-01T00:00:00Z',
    properties: everyServerProperty,
  });

  const collisions = Object.keys(projected.properties).filter((key) =>
    FORBIDDEN_CLIENT_FIELDS.includes(key)
  );
  assert.deepEqual(collisions, [], `audit projection emits client-forbidden keys: ${collisions.join(', ')}`);
  assert.doesNotThrow(() => assertNoForbiddenFields([projected]));
});

test('WP-7D-06 client API fails closed if a response ever carries a forbidden field', () => {
  assert.doesNotThrow(() => assertNoForbiddenFields([{ id: 'c1', health: 'healthy' }]));

  for (const field of ['secretRef', 'keyRef', 'iv', 'authTag', 'plaintext', 'apiKey']) {
    assert.throws(
      () => assertNoForbiddenFields([{ id: 'c1', [field]: 'x' }]),
      (err) => err instanceof ProviderConnectionResponseError && err.field === field,
      field
    );
  }
  // Nested leaks are caught too.
  assert.throws(
    () => assertNoForbiddenFields({ connection: { envelope: { encryptedPayload: 'X' } } }),
    (err) => err instanceof ProviderConnectionResponseError
  );
  assert.ok(FORBIDDEN_CLIENT_FIELDS.includes('secretRef'));
});

test('WP-7D-06 UI display helpers expose only safe labels and gate actions', () => {
  assert.equal(describeConnectionHealth('healthy').label, 'Healthy');
  assert.equal(describeConnectionHealth('rotation_required').actionable, true);
  assert.equal(describeConnectionHealth('nonsense').label, 'Unknown');

  assert.equal(canRotate({ health: 'rotation_required' }), true);
  assert.equal(canRotate({ health: 'revoked' }), false);
  assert.equal(canRevoke({ health: 'deleted' }), false);
  assert.equal(canDelete({ health: 'deleted' }), false);

  const summary = summarizeConnectionHealth([
    { health: 'healthy' }, { health: 'rotation_required' }, { health: 'revoked' },
  ]);
  assert.deepEqual(summary, { total: 3, healthy: 1, needsAttention: 1, inactive: 1 });

  // No display entry names a secret concept.
  const displaySource = codeWithoutComments(
    source('packages/studio/src/provider-connections/health-display.js')
  );
  assert.doesNotMatch(displaySource, /secretRef|keyRef|envelope|authTag|ciphertext/i);
});

test('WP-7D-06 routes use AuthContext helpers, reject legacy, and never accept envelope fields', () => {
  const routes = [
    'app/api/dynaxis/provider-connections/route.js',
    'app/api/dynaxis/provider-connections/[connectionId]/route.js',
    'app/api/dynaxis/provider-connections/[connectionId]/rotate/route.js',
    'app/api/dynaxis/provider-connections/[connectionId]/revoke/route.js',
    'app/api/dynaxis/provider-connections/[connectionId]/audit/route.js',
  ];
  for (const route of routes) {
    const body = source(route);
    assert.match(body, /withAuthContextRoute/, `${route} must use the AuthContext route helper`);
    assert.match(body, /assertCanonicalPrincipal/, `${route} must reject legacy principals`);
    // Routes must not reach into the secret runtime.
    assert.doesNotMatch(body, /secrets\/(keys|envelope)\.js|openSecret|sealSecret|resolveKey/, route);
    assert.doesNotMatch(body, /oauth2|redirect_uri|authorization_code/i, `${route} must not implement OAuth`);
  }

  // The rotation route refuses server-owned fields from clients.
  const rotate = source('app/api/dynaxis/provider-connections/[connectionId]/rotate/route.js');
  for (const field of ['secretRef', 'keyRef', 'encryptedPayload', 'authTag', 'iv', 'aadOwnerId']) {
    assert.ok(rotate.includes(`'${field}'`), `rotate route must forbid client-supplied ${field}`);
  }
});

test('WP-7D-06 adds no OAuth, schema, migration, or provider adapter change', () => {
  assertProviderConnectionMigrationOwnership();

  assert.equal(existsSync(new URL('lib/dynaxis/provider-connections/oauth.js', ROOT)), false);

  for (const file of [
    'lib/dynaxis/provider-connections/health.js',
    'lib/dynaxis/provider-connections/audit-view.js',
    'lib/dynaxis/provider-connections/index.js',
  ]) {
    const body = codeWithoutComments(source(file));
    assert.doesNotMatch(body, /pgTable\(/, `${file} must not declare schema`);
    assert.doesNotMatch(body, /oauth2|redirect_uri|refreshAccessToken/i, `${file} must not implement OAuth`);
  }

  // The server entry point must not re-export secret primitives.
  const indexSource = codeWithoutComments(source('lib/dynaxis/provider-connections/index.js'));
  assert.doesNotMatch(indexSource, /sealSecret|openSecret|resolveKey|dynaxisKeyManager/);
});

test('WP-7D-06 providers/** remains pure and untouched by the console surface', () => {
  const providerFiles = readdirSync(new URL('lib/dynaxis/providers/', ROOT)).filter((f) => f.endsWith('.js'));
  for (const file of providerFiles) {
    const body = source(`lib/dynaxis/providers/${file}`);
    assert.doesNotMatch(body, /provider-connections\//, `${file} must stay a pure adapter`);
    assert.doesNotMatch(body, /secrets\/(keys|envelope)\.js/, `${file} must not import secret internals`);
    assert.doesNotMatch(body, /materializeProviderCredential|useProviderCredential/, file);
  }
});
