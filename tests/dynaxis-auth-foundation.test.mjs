import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  AUTH_SCHEMA_NAME,
  BETTER_AUTH_CORE_MODELS,
  BETTER_AUTH_DRIZZLE_SCHEMA,
  BETTER_AUTH_SCHEMA_NOTES,
} from '../lib/dynaxis/auth/schema.js';
import {
  DYNAXIS_AUTH_APP_NAME,
  DYNAXIS_AUTH_BASE_PATH,
  createDynaxisAuthOptions,
  summarizeDynaxisAuthOptions,
} from '../lib/dynaxis/auth/options.js';
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js';
import {
  LOCAL_PREVIEW_KEY,
  OWNER_REF_SCHEME,
  getApiKeyFromRequest,
  ownerRefFromApiKey,
} from '../lib/dynaxis/ownership.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

test('Phase 7C.1 Better Auth schema is isolated under auth schema', () => {
  const expectedTables = {
    user: 'user',
    session: 'session',
    account: 'account',
    verification: 'verification',
    rateLimit: 'rate_limit',
  };

  assert.deepEqual(BETTER_AUTH_CORE_MODELS, [
    'user',
    'session',
    'account',
    'verification',
    'rateLimit',
  ]);

  for (const [model, tableName] of Object.entries(expectedTables)) {
    const table = BETTER_AUTH_DRIZZLE_SCHEMA[model];
    const config = getTableConfig(table);
    assert.equal(config.schema, AUTH_SCHEMA_NAME);
    assert.equal(config.name, tableName);
  }

  assert.equal(getTableColumns(BETTER_AUTH_DRIZZLE_SCHEMA.user).id.columnType, 'PgUUID');
  assert.equal(getTableColumns(BETTER_AUTH_DRIZZLE_SCHEMA.session).userId.columnType, 'PgUUID');
  assert.equal(getTableColumns(BETTER_AUTH_DRIZZLE_SCHEMA.account).userId.columnType, 'PgUUID');
  assert.equal(BETTER_AUTH_SCHEMA_NOTES.generatedReference, '/tmp/dynaxis-better-auth-1.6.23-schema.ts');
  assert.equal(
    BETTER_AUTH_SCHEMA_NOTES.organizationGeneratedReference,
    '/tmp/dynaxis-better-auth-1.6.23-organization-schema.ts'
  );
});

test('Better Auth schema does not redefine Dynaxis domain tables', () => {
  for (const key of Object.keys(BETTER_AUTH_DRIZZLE_SCHEMA)) {
    assert.doesNotMatch(key, /^dynaxis/i);
  }
  assert.ok('dynaxisProjects' in DRIZZLE_SCHEMA);
  assert.ok('user' in DRIZZLE_SCHEMA);
  assert.ok('session' in DRIZZLE_SCHEMA);
  assert.ok('account' in DRIZZLE_SCHEMA);
  assert.ok('verification' in DRIZZLE_SCHEMA);
  assert.ok('rateLimit' in DRIZZLE_SCHEMA);
});

test('Dynaxis auth options enforce the Phase 7C.1 contract without serializing secrets', () => {
  const options = createDynaxisAuthOptions({
    database: { id: 'test-adapter' },
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'TEST_SECRET_SHOULD_NOT_APPEAR',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
  });
  const summary = summarizeDynaxisAuthOptions(options);

  assert.equal(options.appName, DYNAXIS_AUTH_APP_NAME);
  assert.equal(options.basePath, DYNAXIS_AUTH_BASE_PATH);
  assert.equal(options.emailAndPassword.enabled, true);
  assert.equal(options.emailAndPassword.disableSignUp, true);
  assert.equal(options.emailAndPassword.autoSignIn, false);
  assert.equal(options.emailAndPassword.minPasswordLength, 12);
  assert.equal(options.emailAndPassword.maxPasswordLength, 128);
  assert.equal(options.session.storeSessionInDatabase, true);
  assert.equal(options.session.cookieCache.enabled, false);
  assert.equal(options.rateLimit.enabled, true);
  assert.equal(options.rateLimit.storage, 'database');
  assert.equal(options.rateLimit.window, 10);
  assert.equal(options.rateLimit.max, 100);
  assert.equal(options.telemetry.enabled, false);
  assert.equal(options.advanced.database.generateId, 'uuid');
  assert.deepEqual(options.plugins.map((plugin) => plugin.id), ['organization']);
  assert.equal(options.plugins[0].options.allowUserToCreateOrganization, false);
  assert.equal(options.plugins[0].options.disableOrganizationDeletion, true);
  assert.equal(options.plugins[0].options.teams.enabled, false);
  assert.equal(options.plugins[0].options.dynamicAccessControl.enabled, false);
  assert.equal(options.account.accountLinking.enabled, false);
  assert.doesNotMatch(JSON.stringify(summary), /TEST_SECRET_SHOULD_NOT_APPEAR/);
});

test('browser auth client imports without server-only or database boundary imports', async () => {
  const clientSource = source('lib/dynaxis/auth/client.js');
  assert.doesNotMatch(clientSource, /server-only|getDb|postgres|drizzleAdapter/);
  const mod = await import('../lib/dynaxis/auth/client.js');
  assert.ok(mod.dynaxisAuthClient);
  assert.equal(typeof mod.dynaxisAuthClient.useSession, 'function');
  assert.equal(typeof mod.dynaxisAuthClient.organization, 'function');
});

test('server auth boundary reuses the shared Dynaxis DB pool', () => {
  const serverSource = source('lib/dynaxis/auth/server.js');
  const dbClientSource = source('lib/dynaxis/db/client.js');
  assert.match(serverSource, /getDb/);
  assert.match(serverSource, /drizzleAdapter/);
  assert.doesNotMatch(serverSource, /postgres\s*\(/);
  assert.equal((dbClientSource.match(/postgres\s*\(/g) || []).length, 1);
});

test('legacy ownerRef hashing remains unchanged', () => {
  const key = 'muapi_test_key_phase_7c_1';
  const digest = createHash('sha256').update(key, 'utf8').digest('hex');
  assert.equal(ownerRefFromApiKey(key), `${OWNER_REF_SCHEME}:${digest}`);
  assert.equal(ownerRefFromApiKey(LOCAL_PREVIEW_KEY), `${OWNER_REF_SCHEME}:preview:local`);
});

test('legacy x-api-key auth bridge remains unchanged', () => {
  const request = new Request('https://dynaxis.example.test/api/dynaxis/projects', {
    headers: { 'x-api-key': 'legacy-key' },
  });
  assert.equal(getApiKeyFromRequest(request), 'legacy-key');
  assert.equal(ownerRefFromApiKey(getApiKeyFromRequest(request)), ownerRefFromApiKey('legacy-key'));
  const apiSource = source('lib/dynaxis/api.js');
  assert.match(apiSource, /requireOwnerFromRequest/);
  assert.match(apiSource, /ownerRef/);
  assert.match(apiSource, /apiKey/);
});
