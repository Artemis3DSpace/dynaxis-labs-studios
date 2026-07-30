import test from 'node:test';
import assert from 'node:assert/strict';

import { dynaxisQueryKeys } from '../packages/studio/src/query/keys.js';
import {
  assertNoOwnerRefScope,
  normalizeProjectScope,
  stableFilterScope,
} from '../packages/studio/src/query/scope.js';
import {
  isPlatformAuthError,
  isPlatformForbiddenError,
  normalizePlatformClientError,
  shouldRollbackOptimisticUpdate,
} from '../packages/studio/src/query/errors.js';
import {
  invalidateProjectQueries,
  invalidateWorkspaceQueries,
  resetWorkspaceQueryCache,
} from '../packages/studio/src/query/invalidation.js';
import { createPlatformFetchError } from '../lib/dynaxis/client/platform-api.js';

const ORG_A = 'org_workspace_a';
const ORG_B = 'org_workspace_b';
const PROJECT_A = 'project_a';
const PROJECT_B = 'project_b';

test('query keys are stable for identical scope inputs', () => {
  const first = dynaxisQueryKeys.projects.list(ORG_A, { status: 'active', q: 'demo' });
  const second = dynaxisQueryKeys.projects.list(ORG_A, { q: 'demo', status: 'active' });
  assert.deepEqual(first, second);
});

test('query keys separate workspaces', () => {
  const a = dynaxisQueryKeys.projects.all(ORG_A);
  const b = dynaxisQueryKeys.projects.all(ORG_B);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, ['dynaxis', 'workspace', ORG_A, 'projects']);
});

test('query keys separate projects within a workspace', () => {
  const a = dynaxisQueryKeys.assets.all(ORG_A, PROJECT_A);
  const b = dynaxisQueryKeys.assets.all(ORG_A, PROJECT_B);
  assert.notDeepEqual(a, b);
  assert.ok(a.includes(PROJECT_A));
  assert.ok(b.includes(PROJECT_B));
});

test('query keys reject owner_ref scope leakage', () => {
  assert.throws(
    () => dynaxisQueryKeys.projects.list(ORG_A, { owner_ref: 'ak_sha256:abc' }),
    /owner_ref must not appear/
  );
  assert.throws(() => assertNoOwnerRefScope({ ownerRef: 'legacy' }), /owner_ref must not appear/);
});

test('project scope normalization requires canonical ids', () => {
  const scope = normalizeProjectScope({
    organizationId: ORG_A,
    projectId: PROJECT_A,
    filters: { includeArchived: true },
  });
  assert.equal(scope.organizationId, ORG_A);
  assert.equal(scope.projectId, PROJECT_A);
  assert.deepEqual(scope.filters, { includeArchived: true });
});

test('domain resource keys cover design and mini app execution scopes', () => {
  assert.deepEqual(dynaxisQueryKeys.designTemplates.detail(ORG_A, 'tpl_1'), [
    'dynaxis',
    'workspace',
    ORG_A,
    'design-templates',
    'detail',
    'tpl_1',
  ]);
  assert.deepEqual(
    dynaxisQueryKeys.miniApps.execution(ORG_A, PROJECT_A, 'product-studio', { runId: 'run_1' }),
    [
      'dynaxis',
      'workspace',
      ORG_A,
      'project',
      PROJECT_A,
      'mini-apps',
      'execution',
      'product-studio',
      { runId: 'run_1' },
    ]
  );
});

test('platform client errors classify auth and forbidden boundaries', () => {
  const authErr = createPlatformFetchError(
    { status: 401 },
    { error: 'Authentication required', code: 'DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED' }
  );
  const forbiddenErr = createPlatformFetchError(
    { status: 403 },
    { error: 'Forbidden', code: 'DYNAXIS_ROUTE_AUTH_FORBIDDEN' }
  );

  assert.equal(isPlatformAuthError(authErr), true);
  assert.equal(isPlatformForbiddenError(forbiddenErr), true);
  assert.equal(shouldRollbackOptimisticUpdate(authErr), true);
  assert.equal(normalizePlatformClientError(forbiddenErr).shouldRetry, false);
});

test('invalidation helpers target workspace and project prefixes', async () => {
  const calls = [];
  const queryClient = {
    invalidateQueries: async (opts) => {
      calls.push(['invalidate', opts.queryKey]);
    },
    removeQueries: async (opts) => {
      calls.push(['remove', opts.queryKey]);
    },
  };

  await invalidateWorkspaceQueries(queryClient, ORG_A);
  await invalidateProjectQueries(queryClient, ORG_A, PROJECT_A);
  await resetWorkspaceQueryCache(queryClient);

  assert.deepEqual(calls[0][1], dynaxisQueryKeys.workspace(ORG_A));
  assert.deepEqual(calls[1][1], [
    ...dynaxisQueryKeys.workspace(ORG_A),
    'project',
    PROJECT_A,
  ]);
  assert.deepEqual(calls[2][1], dynaxisQueryKeys.all);
});

test('stableFilterScope strips undefined values and owner_ref keys', () => {
  assert.deepEqual(
    stableFilterScope({ b: '2', a: '1', owner_ref: 'legacy', empty: undefined }),
    { a: '1', b: '2' }
  );
});
