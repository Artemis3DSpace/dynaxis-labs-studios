import test from 'node:test';
import assert from 'node:assert/strict';

import { dynaxisQueryKeys } from '../packages/studio/src/query/keys.js';
import { assertNoOwnerRefScope } from '../packages/studio/src/query/scope.js';
import {
  normalizeProjectListFilters,
} from '../packages/studio/src/projects/api.js';
import {
  invalidateProjectCatalogQueries,
  invalidateProjectDetailQuery,
  invalidateProjectMutationQueries,
} from '../packages/studio/src/projects/invalidation.js';
import {
  filterProjectsForWorkspace,
  isProjectInWorkspace,
  resolvePreferredProject,
} from '../packages/studio/src/projects/selection.js';
import { createWorkspaceSessionController } from '../packages/studio/src/session/workspace-controller.js';
import {
  clearProjectContext,
  publishProjectContext,
  publishWorkspaceContext,
  readProjectContext,
} from '../lib/dynaxis/client/project-context.js';

const ORG_A = 'org_workspace_a';
const ORG_B = 'org_workspace_b';
const PROJECT_A = 'project_a';
const PROJECT_B = 'project_b';
const PROJECT_C = 'project_c';

function installBrowserGlobals() {
  global.window = {
    __dynaxisOrganizationId: null,
    __dynaxisUserId: null,
    __dynaxisProjectId: null,
    __dynaxisFeatureId: null,
    __dynaxisProject: null,
    localStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.get(key) ?? null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
      removeItem(key) {
        this.store.delete(key);
      },
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

function uninstallBrowserGlobals() {
  delete global.window;
  delete global.CustomEvent;
}

function createMockQueryClient() {
  const calls = [];
  return {
    calls,
    invalidateQueries: async (opts) => {
      calls.push(['invalidate', opts.queryKey]);
    },
    removeQueries: async (opts) => {
      calls.push(['remove', opts.queryKey]);
    },
    cancelQueries: async (opts) => {
      calls.push(['cancel', opts.queryKey]);
    },
  };
}

test('project list query keys are workspace-separated', () => {
  const a = dynaxisQueryKeys.projects.list(ORG_A, { includeArchived: false });
  const b = dynaxisQueryKeys.projects.list(ORG_B, { includeArchived: false });
  assert.notDeepEqual(a, b);
  assert.deepEqual(a.slice(0, 3), ['dynaxis', 'workspace', ORG_A]);
});

test('project detail query keys isolate projects within a workspace', () => {
  const a = dynaxisQueryKeys.projects.detail(ORG_A, PROJECT_A);
  const b = dynaxisQueryKeys.projects.detail(ORG_A, PROJECT_B);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, ['dynaxis', 'workspace', ORG_A, 'projects', 'detail', PROJECT_A]);
});

test('project list filters reject owner_ref leakage', () => {
  assert.throws(
    () => normalizeProjectListFilters({ owner_ref: 'legacy' }),
    /owner_ref must not appear/
  );
  assert.throws(() => assertNoOwnerRefScope({ ownerRef: 'legacy' }), /owner_ref must not appear/);
});

test('resolvePreferredProject prefers stored, default, then first project', () => {
  const projects = [
    { id: PROJECT_A, isDefault: false },
    { id: PROJECT_B, isDefault: true },
    { id: PROJECT_C, isDefault: false },
  ];
  assert.equal(resolvePreferredProject(projects, { storedProjectId: PROJECT_C })?.id, PROJECT_C);
  assert.equal(resolvePreferredProject(projects, { storedProjectId: null })?.id, PROJECT_B);
  assert.equal(
    resolvePreferredProject([{ id: PROJECT_A, isDefault: false }], { storedProjectId: null })?.id,
    PROJECT_A
  );
});

test('filterProjectsForWorkspace removes cross-workspace project rows', () => {
  const projects = [
    { id: PROJECT_A, organizationId: ORG_A },
    { id: PROJECT_B, organizationId: ORG_B },
    { id: PROJECT_C, organizationId: ORG_A },
  ];
  const filtered = filterProjectsForWorkspace(projects, ORG_A);
  assert.deepEqual(
    filtered.map((project) => project.id),
    [PROJECT_A, PROJECT_C]
  );
  assert.equal(isProjectInWorkspace(ORG_A, ORG_B), false);
});

test('project mutation invalidation targets catalog and detail keys', async () => {
  const queryClient = createMockQueryClient();
  await invalidateProjectMutationQueries(queryClient, ORG_A, PROJECT_A);

  assert.deepEqual(queryClient.calls[0], ['invalidate', dynaxisQueryKeys.projects.all(ORG_A)]);
  assert.deepEqual(queryClient.calls[1], [
    'invalidate',
    dynaxisQueryKeys.projects.detail(ORG_A, PROJECT_A),
  ]);

  queryClient.calls.length = 0;
  await invalidateProjectCatalogQueries(queryClient, ORG_A);
  await invalidateProjectDetailQuery(queryClient, ORG_A, PROJECT_B);
  assert.deepEqual(queryClient.calls[0][1], dynaxisQueryKeys.projects.all(ORG_A));
  assert.deepEqual(queryClient.calls[1][1], dynaxisQueryKeys.projects.detail(ORG_A, PROJECT_B));
});

test('workspace switch clears selected project context', async () => {
  installBrowserGlobals();
  try {
    publishWorkspaceContext({ organizationId: ORG_A, userId: 'user_a' });
    publishProjectContext({ projectId: PROJECT_A });

    const queryClient = createMockQueryClient();
    const controller = createWorkspaceSessionController({
      queryClient,
      authClient: {},
      fetchSession: async () => ({
        user: { id: 'user_a' },
        session: { activeOrganizationId: ORG_B },
      }),
      switchOrganization: async () => ({ id: ORG_B }),
    });

    await controller.hydrateFromSession({
      user: { id: 'user_a' },
      session: { activeOrganizationId: ORG_A },
    });
    await controller.switchWorkspace(ORG_B);

    assert.equal(readProjectContext().projectId, null);
    assert.ok(queryClient.calls.some(([op]) => op === 'remove' || op === 'invalidate'));
  } finally {
    uninstallBrowserGlobals();
  }
});

test('missing workspace keeps project queries disabled via empty organization scope', () => {
  installBrowserGlobals();
  try {
    clearProjectContext();
    publishWorkspaceContext({ organizationId: null, userId: null });
    assert.equal(readProjectContext().organizationId, null);
    assert.equal(readProjectContext().projectId, null);
  } finally {
    uninstallBrowserGlobals();
  }
});

test('cross-workspace stale project rows are not treated as current workspace data', () => {
  const stale = filterProjectsForWorkspace(
    [{ id: PROJECT_A, organizationId: ORG_A }],
    ORG_B
  );
  assert.deepEqual(stale, []);
});
