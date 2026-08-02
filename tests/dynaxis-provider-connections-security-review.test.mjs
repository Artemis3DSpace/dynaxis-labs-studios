/**
 * WP-7D-07 Provider Connection Security Review — negative tests.
 *
 * These are adversarial by construction: each test attempts an attack and
 * asserts it fails, rather than asserting a happy path succeeds. Positive
 * behaviour is already covered by the WP-7D-03..06 suites.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createDynaxisKeyManager } from '../lib/dynaxis/secrets/keys.js';
import { openSecret, sealSecret } from '../lib/dynaxis/secrets/envelope.js';
import { DYNAXIS_SECRET_ERROR_CODES } from '../lib/dynaxis/secrets/errors.js';
import { PROVIDER_CONNECTION_ERROR_CODES } from '../lib/dynaxis/provider-connections/errors.js';
import {
  createMemoryAuditSink,
  createProviderConnectionAuditor,
} from '../lib/dynaxis/provider-connections/audit.js';
import { createProviderConnectionService } from '../lib/dynaxis/provider-connections/service.js';
import { authorizeProviderConnection } from '../lib/dynaxis/provider-connections/policy.js';
import { PROVIDER_CONNECTION_PERMISSION_NAMES } from '../lib/dynaxis/provider-connections/permissions.js';
import {
  DYNAXIS_MUAPI_PROVIDER_ID,
  selectProviderConnection,
  withMuapiCredential,
} from '../lib/dynaxis/provider-connections/resolver.js';
import { importLegacyMuapiCredential } from '../lib/dynaxis/provider-connections/muapi-migration.js';
import {
  getConnectionHealth,
  listConnectionHealth,
} from '../lib/dynaxis/provider-connections/health.js';
import {
  AUDIT_BROWSER_FORBIDDEN_PROPERTIES,
  readProviderConnectionAudit,
  toPublicAuditEvent,
} from '../lib/dynaxis/provider-connections/audit-view.js';
import { assertCanonicalPrincipal } from '../lib/dynaxis/provider-connections/route-guard.js';
import {
  FORBIDDEN_CLIENT_FIELDS,
  assertNoForbiddenFields,
} from '../packages/studio/src/provider-connections/api.js';

const ROOT = new URL('..', import.meta.url);
const source = (p) => readFileSync(new URL(p, ROOT), 'utf8');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '99999999-9999-4999-8999-999999999999';
const ORG_A = '22222222-2222-4222-8222-222222222222';
const ORG_B = '88888888-8888-4888-8888-888888888888';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const SECRET_A = 'muapi_live_ORG_A_SECRET_VALUE';
const SECRET_B = 'muapi_live_ORG_B_SECRET_VALUE';

const KEYS = createDynaxisKeyManager({ env: { NODE_ENV: 'test' } });

/** Everything a browser/API/Studio response must never contain. */
const FORBIDDEN_RESPONSE_FIELDS = Object.freeze([
  'secretRef', 'keyRef', 'secretVersion', 'secretStatus', 'previousSecretStatus',
  'envelopeId', 'envelopeCreatedAt', 'encryptedPayload', 'ciphertext', 'iv', 'authTag',
  'aad', 'aadOwnerType', 'aadOwnerId', 'aadProviderId', 'aadCredentialKind', 'aadSecretVersion',
  'plaintext', 'secret', 'apiKey', 'accessToken', 'refreshToken', 'clientSecret',
  'serviceAccountJson', 'webhookSecret', 'rotationInProgress', 'algorithm',
]);

function assertNoForbiddenShape(value, label) {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      if (FORBIDDEN_RESPONSE_FIELDS.includes(key)) found.push(key);
    }
    Object.values(node).forEach(walk);
  };
  walk(value);
  assert.deepEqual(found, [], `${label} exposed: ${found.join(', ')}`);
  const serialized = JSON.stringify(value);
  for (const literal of [SECRET_A, SECRET_B, 'test://', 'kms://', 'local://']) {
    assert.ok(!serialized.includes(literal), `${label} leaked literal ${literal}`);
  }
}

function human(userId, workspace = null, project = null) {
  return {
    subject: { type: 'user', userId },
    principal: { type: 'human', principalId: `user:${userId}`, userId, authMethod: 'session' },
    workspace,
    project,
  };
}

function legacy() {
  const ref = 'ak_sha256:deadbeef';
  return {
    subject: { type: 'legacy', legacyOwnerRef: ref, authMethod: 'legacy-muapi-key' },
    principal: { type: 'legacy', legacyOwnerRef: ref, authMethod: 'legacy-muapi-key' },
    workspace: null,
  };
}

function service(principal) {
  return { subject: { type: 'service-account', serviceAccountId: 'worker-1' }, principal, workspace: null };
}

const ws = (organizationId, role = 'owner') => ({ organizationId, role, isMember: true });

function memoryRepository() {
  const connections = new Map();
  const envelopes = new Map();
  return {
    connections,
    envelopes,
    async insertConnection(v) { connections.set(v.id, { ...v }); return { ...v }; },
    async updateConnection(id, p) {
      const e = connections.get(id);
      if (!e) return null;
      const n = { ...e, ...p, updatedAt: new Date() };
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
    async updateEnvelope(id, p) {
      const e = envelopes.get(id);
      if (!e) return null;
      const n = { ...e, ...p };
      envelopes.set(id, n);
      return { ...n };
    },
  };
}

function harness() {
  const repository = memoryRepository();
  const sink = createMemoryAuditSink();
  const svc = createProviderConnectionService({
    repository,
    auditor: createProviderConnectionAuditor({ sink }),
    keyManager: KEYS,
  });
  return { repository, sink, service: svc };
}

/** Two isolated tenants plus a user-owned connection, for isolation probes. */
async function seedTwoTenants(h) {
  const a = await h.service.create(human(USER_A, ws(ORG_A)), {
    providerId: 'muapi', ownerType: 'workspace', ownerWorkspaceId: ORG_A,
    credentialKind: 'api_key', secret: SECRET_A,
  });
  h.repository.connections.get(a.id).defaultForWorkspace = true;
  const b = await h.service.create(human(USER_B, ws(ORG_B)), {
    providerId: 'muapi', ownerType: 'workspace', ownerWorkspaceId: ORG_B,
    credentialKind: 'api_key', secret: SECRET_B,
  });
  h.repository.connections.get(b.id).defaultForWorkspace = true;
  const userOwned = await h.service.create(human(USER_A), {
    providerId: 'muapi', ownerType: 'user', ownerUserId: USER_A,
    credentialKind: 'api_key', secret: SECRET_A,
  });
  h.repository.connections.get(userOwned.id).defaultForUser = true;
  return { a, b, userOwned };
}

test('WP-7D-07 #1 secret exfiltration is prevented across every browser-facing surface', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const owner = human(USER_A, ws(ORG_A, 'admin'));

  await h.service.rotate(owner, a.id, { secret: 'ROTATED_EXFIL_PROBE' });
  await h.service.markSecretStatus(a.id, 'corrupted');

  assertNoForbiddenShape(await listConnectionHealth(owner, { service: h.service, organizationId: ORG_A }), 'health list');
  assertNoForbiddenShape(await getConnectionHealth(owner, { service: h.service, connectionId: a.id }), 'health detail');
  assertNoForbiddenShape(await readProviderConnectionAudit(owner, { service: h.service, connectionId: a.id }), 'audit');
  assertNoForbiddenShape(await h.service.revoke(owner, a.id), 'revoke');
  assertNoForbiddenShape(await h.service.remove(owner, a.id), 'delete');

  const all = JSON.stringify([...h.sink.list()]);
  assert.ok(!all.includes('ROTATED_EXFIL_PROBE'), 'audit sink must not hold rotated plaintext');
});

test('WP-7D-07 #2 cross-workspace ProviderConnection selection is denied', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const intruder = human(USER_B, ws(ORG_B));

  assert.deepEqual(
    await listConnectionHealth(intruder, { service: h.service, organizationId: ORG_A }),
    [],
    'foreign organizationId must not enumerate'
  );
  await assert.rejects(
    withMuapiCredential(intruder, { service: h.service, organizationId: ORG_A }, async () => 'nope'),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
  await assert.rejects(
    selectProviderConnection(intruder, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: a.id }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
  );
});

test('WP-7D-07 #3 cross-user ProviderConnection selection is denied', async () => {
  const h = harness();
  const { userOwned } = await seedTwoTenants(h);
  // A workspace owner is still not the owning user of a user-owned connection.
  const other = human(USER_B, ws(ORG_A, 'owner'));

  await assert.rejects(
    selectProviderConnection(other, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: userOwned.id }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
  );
  await assert.rejects(
    getConnectionHealth(other, { service: h.service, connectionId: userOwned.id }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
});

test('WP-7D-07 #4/#5/#6 resolver-selection regressions: foreign id, ownerUserId spoof, null workspace', async () => {
  const h = harness();
  const { a, userOwned } = await seedTwoTenants(h);
  const intruder = human(USER_B, ws(ORG_B));

  // #4 foreign explicit connectionId (user-owned target)
  await assert.rejects(
    selectProviderConnection(intruder, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: userOwned.id }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
  );

  // #5 foreign ownerUserId default spoof
  await assert.rejects(
    selectProviderConnection(intruder, {
      service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, ownerType: 'user', ownerUserId: USER_A,
    }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );

  // #6 null workspace context plus foreign organizationId
  const noWorkspace = human(USER_B, null);
  await assert.rejects(
    selectProviderConnection(noWorkspace, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, organizationId: ORG_A }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
  // A caller with no active workspace targeting a workspace-owned connection
  // is denied with FORBIDDEN (the policy reports NO_WORKSPACE before it can
  // compare ownership). Either denial code is acceptable; what matters is that
  // no row is returned.
  await assert.rejects(
    selectProviderConnection(noWorkspace, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: a.id }),
    (e) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
      ].includes(e.code)
  );
});

test('WP-7D-07 #7 confused-deputy: one tenant cannot make the resolver spend another tenant credential', async () => {
  const h = harness();
  const { a, b } = await seedTwoTenants(h);

  // Tenant B asks for MuAPI while naming tenant A's connection and org.
  let observed = null;
  await assert.rejects(
    withMuapiCredential(
      human(USER_B, ws(ORG_B)),
      { service: h.service, connectionId: a.id, organizationId: ORG_A },
      async ({ apiKey }) => { observed = apiKey; }
    ),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
  );
  assert.equal(observed, null, 'dispatch callback must never run');

  // Repointing B's connection at A's envelope is rejected by AAD binding.
  const aEnvelope = h.repository.connections.get(a.id).secretRef;
  h.repository.connections.get(b.id).secretRef = aEnvelope;
  await assert.rejects(
    withMuapiCredential(human(USER_B, ws(ORG_B)), { service: h.service, connectionId: b.id }, async () => 'nope'),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH
  );
});

test('WP-7D-07 #8 providerId mismatch is denied at selection and after materialization', async () => {
  const h = harness();
  const replicate = await h.service.create(human(USER_A, ws(ORG_A)), {
    providerId: 'replicate', ownerType: 'workspace', ownerWorkspaceId: ORG_A,
    credentialKind: 'api_key', secret: 'replicate_secret',
  });
  h.repository.connections.get(replicate.id).defaultForWorkspace = true;

  await assert.rejects(
    selectProviderConnection(human(USER_A, ws(ORG_A)), {
      service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: replicate.id,
    }),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.UNSUPPORTED_PROVIDER
  );
  await assert.rejects(
    withMuapiCredential(human(USER_A, ws(ORG_A)), { service: h.service, organizationId: ORG_A }, async () => 'nope'),
    (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND
  );
});

test('WP-7D-07 #9 capability and model restrictions cannot be bypassed', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  Object.assign(h.repository.connections.get(a.id), {
    allowedCapabilities: ['image.generate'],
    allowedProviderModels: ['model-a'],
  });
  const ctx = human(USER_A, ws(ORG_A, 'member'));

  for (const [opts, code] of [
    [{ capabilityId: 'video.generate' }, PROVIDER_CONNECTION_ERROR_CODES.CAPABILITY_DENIED],
    [{ modelId: 'model-z' }, PROVIDER_CONNECTION_ERROR_CODES.MODEL_DENIED],
  ]) {
    let leaked = null;
    await assert.rejects(
      withMuapiCredential(ctx, { service: h.service, connectionId: a.id, ...opts }, async ({ apiKey }) => { leaked = apiKey; }),
      (e) => e.code === code
    );
    assert.equal(leaked, null);
  }
});

test('WP-7D-07 #10 workspace role never substitutes for Project execution authority', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const base = { service: h.service, connectionId: a.id, projectScoped: true };

  for (const project of [
    null,
    { projectId: PROJECT, isMember: false },
    { projectId: PROJECT, isMember: true, role: 'viewer' },
  ]) {
    await assert.rejects(
      withMuapiCredential(human(USER_A, ws(ORG_A, 'owner'), project), base, async () => 'nope'),
      (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN
    );
  }
});

test('WP-7D-07 #11 legacy x-api-key gets no ProviderConnection authority on any operation', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const ctx = legacy();

  assert.throws(() => assertCanonicalPrincipal(ctx), (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN);
  assert.deepEqual(await listConnectionHealth(ctx, { service: h.service, organizationId: ORG_A }), []);

  for (const call of [
    () => getConnectionHealth(ctx, { service: h.service, connectionId: a.id }),
    () => selectProviderConnection(ctx, { service: h.service, providerId: DYNAXIS_MUAPI_PROVIDER_ID, connectionId: a.id }),
    () => withMuapiCredential(ctx, { service: h.service, connectionId: a.id }, async () => 'nope'),
    () => h.service.rotate(ctx, a.id, { secret: 'x'.repeat(24) }),
    () => h.service.revoke(ctx, a.id),
    () => h.service.remove(ctx, a.id),
    () => readProviderConnectionAudit(ctx, { service: h.service, connectionId: a.id }),
    () => importLegacyMuapiCredential(ctx, { service: h.service, apiKey: 'k', ownerType: 'workspace', ownerWorkspaceId: ORG_A }),
  ]) {
    await assert.rejects(call, (e) =>
      [
        PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
        PROVIDER_CONNECTION_ERROR_CODES.OWNER_MISMATCH,
        PROVIDER_CONNECTION_ERROR_CODES.NOT_FOUND,
      ].includes(e.code)
    );
  }

  // Every permission denies a legacy principal at the policy layer too.
  for (const permission of PROVIDER_CONNECTION_PERMISSION_NAMES) {
    const decision = authorizeProviderConnection({
      permission, principal: ctx.principal, workspace: ws(ORG_A),
      connection: h.repository.connections.get(a.id),
    });
    assert.equal(decision.allowed, false, permission);
  }
});

test('WP-7D-07 #12 service principals remain fail-closed with no allowlist', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const principals = [
    { type: 'service', principalId: 'svc-1', authMethod: 'internal' },
    { type: 'api-key', principalId: 'key-1', authMethod: 'api-key' },
    { type: 'provider-credential', provider: 'muapi', authMethod: 'api-key' },
  ];

  for (const principal of principals) {
    const ctx = service(principal);
    assert.throws(() => assertCanonicalPrincipal(ctx), (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN, principal.type);
    await assert.rejects(
      withMuapiCredential(ctx, { service: h.service, connectionId: a.id }, async () => 'nope'),
      (e) => e.code === PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      principal.type
    );
    for (const permission of PROVIDER_CONNECTION_PERMISSION_NAMES) {
      assert.equal(
        authorizeProviderConnection({ permission, principal, workspace: ws(ORG_A), connection: h.repository.connections.get(a.id) }).allowed,
        false,
        `${principal.type} ${permission}`
      );
    }
  }

  // No allowlist mechanism exists yet — asserted so WP-7E cannot assume one.
  const policySource = source('lib/dynaxis/provider-connections/policy.js');
  assert.doesNotMatch(policySource, /serviceAllowlist|allowedServiceAccounts/, 'no service allowlist should exist yet');
});

test('WP-7D-07 #13/#14 API and Studio responses, including audit, stay redacted', async () => {
  const h = harness();
  const { a } = await seedTwoTenants(h);
  const owner = human(USER_A, ws(ORG_A, 'admin'));
  await h.service.rotate(owner, a.id, { secret: 'ROTATE_FOR_AUDIT' });

  const surfaces = {
    list: await listConnectionHealth(owner, { service: h.service, organizationId: ORG_A }),
    detail: await getConnectionHealth(owner, { service: h.service, connectionId: a.id }),
    audit: await readProviderConnectionAudit(owner, { service: h.service, connectionId: a.id }),
  };
  for (const [label, value] of Object.entries(surfaces)) {
    assertNoForbiddenShape(value, label);
    assert.doesNotThrow(() => assertNoForbiddenFields(Array.isArray(value) ? value : [value]), label);
  }

  // algorithm is stripped from the public audit projection (WP-7D-07 follow-up 4).
  assert.ok(AUDIT_BROWSER_FORBIDDEN_PROPERTIES.includes('algorithm'));
  const projected = toPublicAuditEvent({
    event: 'provider_connection.rotated', occurredAt: 't',
    properties: { connectionId: 'c1', algorithm: 'aes-256-gcm', secretVersion: 4, correlationId: 'k' },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(projected.properties, 'algorithm'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected.properties, 'secretVersion'), false);
  assert.equal(projected.properties.correlationId, 'k', 'correlation id is safe and preserved');
});

test('WP-7D-07 #15 route errors expose only a sanitized message and code', () => {
  // `jsonError` serializes exactly {error, code}; the policy `decision` object
  // attached to ProviderConnectionError is never included.
  const apiSource = source('lib/dynaxis/api.js');
  assert.match(apiSource, /error:\s*err\.message/);
  assert.match(apiSource, /code:\s*err\.code/);
  assert.doesNotMatch(apiSource, /\.\.\.err\b|JSON\.stringify\(err\)|decision/);

  // No ProviderConnection error message embeds secret material or references.
  const errorsSource = source('lib/dynaxis/provider-connections/errors.js');
  assert.doesNotMatch(errorsSource, /secretRef|keyRef|encryptedPayload|authTag|\biv\b/);

  for (const route of readdirSync(new URL('app/api/dynaxis/provider-connections/', ROOT), { recursive: true })) {
    if (!String(route).endsWith('route.js')) continue;
    const body = source(`app/api/dynaxis/provider-connections/${route}`);
    assert.doesNotMatch(body, /jsonOk\(\s*err|NextResponse\.json\(\s*err/, `${route} must not return raw errors`);
  }
});

test('WP-7D-07 #16 logs and audit never contain raw credentials', async () => {
  const h = harness();
  const logged = [];
  const original = { log: console.log, error: console.error, warn: console.warn };
  console.log = (...a) => logged.push(a.join(' '));
  console.error = (...a) => logged.push(a.join(' '));
  console.warn = (...a) => logged.push(a.join(' '));
  try {
    const { a } = await seedTwoTenants(h);
    const owner = human(USER_A, ws(ORG_A, 'admin'));
    await h.service.rotate(owner, a.id, { secret: 'LOG_PROBE_SECRET' });
    await withMuapiCredential(human(USER_A, ws(ORG_A, 'member')), { service: h.service, connectionId: a.id }, async () => 'ok');
    // Force a failure path too.
    h.repository.envelopes.clear();
    h.repository.connections.get(a.id).secretRef = null;
    await withMuapiCredential(human(USER_A, ws(ORG_A, 'member')), { service: h.service, connectionId: a.id }, async () => 'ok').catch(() => {});
  } finally {
    Object.assign(console, original);
  }

  const combined = logged.join('\n') + JSON.stringify(h.sink.list());
  for (const literal of [SECRET_A, SECRET_B, 'LOG_PROBE_SECRET', 'test://']) {
    assert.ok(!combined.includes(literal), `logs/audit leaked ${literal}`);
  }
});

test('WP-7D-07 #17 provider adapters cannot import ProviderConnection or secret internals', () => {
  const files = readdirSync(new URL('lib/dynaxis/providers/', ROOT)).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const body = source(`lib/dynaxis/providers/${file}`);
    assert.doesNotMatch(body, /provider-connections\//, `${file} must not import ProviderConnection`);
    assert.doesNotMatch(body, /secrets\/(keys|envelope|schema)\.js/, `${file} must not import secret internals`);
    assert.doesNotMatch(body, /materializeProviderCredential|useProviderCredential|openSecret|sealSecret|resolveKey/, file);
    // Adapters must not resolve identity either.
    assert.doesNotMatch(body, /auth-context|getSession|betterAuth/i, `${file} must not authenticate users`);
  }
});

test('WP-7D-07 #18 ProviderConnection credentials cannot create or become identity subjects', async () => {
  const h = harness();
  const imported = await importLegacyMuapiCredential(human(USER_A, ws(ORG_A)), {
    service: h.service, apiKey: SECRET_A, ownerType: 'workspace', ownerWorkspaceId: ORG_A,
  });
  const row = h.repository.connections.get(imported.id);

  // No owner_ref / legacy identity is derived from credential material.
  assert.equal(row.ownerRef, undefined);
  assert.doesNotMatch(JSON.stringify(row), /ak_sha256/);

  // Ownership points at Better Auth ids, never at provider account metadata.
  assert.equal(row.ownerWorkspaceId, ORG_A);
  assert.equal(row.providerAccountId, null);

  // A provider credential is not an accepted principal shape.
  for (const principal of [
    { type: 'provider-credential', provider: 'muapi', authMethod: 'api-key' },
    { type: 'model-account', principalId: 'acct-1', authMethod: 'api-key' },
    { type: 'worker-adapter', principalId: 'w-1', authMethod: 'internal' },
  ]) {
    for (const permission of PROVIDER_CONNECTION_PERMISSION_NAMES) {
      assert.equal(
        authorizeProviderConnection({ permission, principal, workspace: ws(ORG_A), connection: row }).allowed,
        false,
        `${principal.type} ${permission}`
      );
    }
  }

  // Provider account metadata is never consulted for authorization.
  assert.equal(/providerAccount/.test(source('lib/dynaxis/provider-connections/policy.js')), false);

  // Better Auth remains the workspace/membership primitive: ownership columns
  // are Better Auth foreign keys, not provider-derived values.
  const schemaSource = source('lib/dynaxis/provider-connections/schema.js');
  assert.match(schemaSource, /ownerUserId.*references\(\(\) => user\.id/s);
  assert.match(schemaSource, /ownerWorkspaceId.*references\(\(\) => organization\.id/s);
});

test('WP-7D-07 AAD binding still rejects forged context and wrong keys', async () => {
  const context = { ownerType: 'workspace', ownerId: ORG_A, providerId: 'muapi', credentialKind: 'api_key', secretVersion: 1 };
  const sealed = await sealSecret({ plaintext: SECRET_A, context, keyManager: KEYS });

  // Forging the persisted AAD columns does not defeat the AEAD tag.
  await assert.rejects(
    openSecret({ envelope: { ...sealed, aadOwnerId: ORG_B }, expectedContext: { ...context, ownerId: ORG_B }, keyManager: KEYS }),
    (e) => e.code === DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT
  );
  // Wrong key fails closed.
  const otherKeys = createDynaxisKeyManager({
    env: { NODE_ENV: 'development', DYNAXIS_SECRET_LOCAL_KEY: Buffer.alloc(32, 5).toString('base64') },
  });
  await assert.rejects(
    openSecret({ envelope: { ...sealed, keyRef: 'local://default' }, expectedContext: context, keyManager: otherKeys }),
    (e) => e.code === DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT
  );
});

test('WP-7D-07 route guard lives in a shared server helper, not a route module', () => {
  // Follow-up 2: routes import the guard from the ProviderConnection layer.
  const guard = source('lib/dynaxis/provider-connections/route-guard.js');
  assert.match(guard, /export function assertCanonicalPrincipal/);
  assert.match(guard, /server-only/);

  for (const route of readdirSync(new URL('app/api/dynaxis/provider-connections/', ROOT), { recursive: true })) {
    if (!String(route).endsWith('route.js')) continue;
    const body = source(`app/api/dynaxis/provider-connections/${route}`);
    assert.match(body, /assertCanonicalPrincipal/, `${route} must guard the principal`);
    assert.doesNotMatch(body, /from '\.\.?\/(\.\.\/)*route\.js'/, `${route} must not import across route modules`);
    assert.doesNotMatch(body, /export function assertCanonicalPrincipal/, `${route} must not define the guard`);
  }
});

test('WP-7D-07 no schema, migration, OAuth, or provider adapter change was introduced', () => {
  const migrations = readdirSync(new URL('drizzle/', ROOT)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(migrations.length >= 16);
  assert.ok(migrations.includes('0015_phase_7d_3_provider_connections.sql'));

  for (const file of [
    'lib/dynaxis/provider-connections/health.js',
    'lib/dynaxis/provider-connections/audit-view.js',
    'lib/dynaxis/provider-connections/route-guard.js',
  ]) {
    const body = source(file);
    assert.doesNotMatch(body, /pgTable\(/, `${file} must not declare schema`);
    assert.doesNotMatch(body, /oauth2|redirect_uri|refreshAccessToken/i, `${file} must not implement OAuth`);
  }

  // The Studio fail-closed guard is still present and still strict.
  assert.ok(FORBIDDEN_CLIENT_FIELDS.includes('secretVersion'));
  assert.ok(FORBIDDEN_CLIENT_FIELDS.includes('secretStatus'));
  assert.throws(() => assertNoForbiddenFields([{ keyRef: 'x' }]));
});
