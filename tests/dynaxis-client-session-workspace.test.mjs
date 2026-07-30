import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectDynaxisSessionContext,
  resolveSessionOrganizationId,
  resolveSessionUserId,
} from '../lib/dynaxis/auth/client.js';
import {
  assertNoOwnerRefInContext,
  publishProjectContext,
  publishWorkspaceContext,
  readProjectContext,
  readWorkspaceContext,
  subscribeProjectContext,
  subscribeWorkspaceContext,
} from '../lib/dynaxis/client/project-context.js';
import { createWorkspaceSessionController } from '../packages/studio/src/session/workspace-controller.js';
import { dynaxisQueryKeys } from '../packages/studio/src/query/keys.js';
import { onWorkspaceContextChanged } from '../packages/studio/src/query/invalidation.js';

const ORG_A = 'org_workspace_a';
const ORG_B = 'org_workspace_b';
const USER_A = 'user_a';
const PROJECT_A = 'project_a';
const PROJECT_B = 'project_b';

function installBrowserGlobals() {
  const storage = new Map();
  const listeners = new Map();

  global.window = {
    __dynaxisOrganizationId: null,
    __dynaxisUserId: null,
    __dynaxisProjectId: null,
    __dynaxisFeatureId: null,
    __dynaxisProject: null,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) {
        handler(event);
      }
      return true;
    },
  };

  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };

  return { storage, listeners };
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

test('session projection resolves canonical organization and user ids', () => {
  const session = {
    user: { id: USER_A },
    session: { activeOrganizationId: ORG_A },
  };
  assert.equal(resolveSessionOrganizationId(session), ORG_A);
  assert.equal(resolveSessionUserId(session), USER_A);
  assert.deepEqual(projectDynaxisSessionContext(session), {
    organizationId: ORG_A,
    userId: USER_A,
    hasSession: true,
  });
});

test('null session projection is safe', () => {
  assert.deepEqual(projectDynaxisSessionContext(null), {
    organizationId: null,
    userId: null,
    hasSession: false,
  });
});

test('workspace context publication notifies subscribers', () => {
  installBrowserGlobals();
  try {
    const events = [];
    const unsubscribe = subscribeWorkspaceContext((detail) => events.push(detail));

    publishWorkspaceContext({ organizationId: ORG_A, userId: USER_A });
    publishWorkspaceContext({ organizationId: ORG_B, userId: USER_A });

    assert.equal(events.length, 2);
    assert.deepEqual(events[0], { organizationId: ORG_A, userId: USER_A });
    assert.deepEqual(events[1], { organizationId: ORG_B, userId: USER_A });
    assert.deepEqual(readWorkspaceContext(), { organizationId: ORG_B, userId: USER_A });

    unsubscribe();
  } finally {
    uninstallBrowserGlobals();
  }
});

test('project context publication notifies subscribers', () => {
  installBrowserGlobals();
  try {
    const events = [];
    publishWorkspaceContext({ organizationId: ORG_A, userId: USER_A });
    const unsubscribe = subscribeProjectContext((detail) => events.push(detail));

    publishProjectContext({ projectId: PROJECT_A });
    publishProjectContext({ projectId: PROJECT_B });

    assert.equal(events.length, 2);
    assert.equal(events[0].projectId, PROJECT_A);
    assert.equal(events[1].projectId, PROJECT_B);
    assert.deepEqual(readProjectContext(), {
      organizationId: ORG_A,
      projectId: PROJECT_B,
      featureId: null,
    });

    unsubscribe();
  } finally {
    uninstallBrowserGlobals();
  }
});

test('client context rejects owner_ref leakage', () => {
  installBrowserGlobals();
  try {
    assert.throws(
      () => publishWorkspaceContext({ organizationId: ORG_A, owner_ref: 'legacy' }),
      /owner_ref must not appear/
    );
    assert.throws(() => assertNoOwnerRefInContext({ ownerRef: 'legacy' }), /owner_ref must not appear/);
  } finally {
    uninstallBrowserGlobals();
  }
});

test('workspace switch resets query cache and clears project context', async () => {
  installBrowserGlobals();
  try {
    publishWorkspaceContext({ organizationId: ORG_A, userId: USER_A });
    publishProjectContext({ projectId: PROJECT_A });

    const queryClient = createMockQueryClient();
    let activeOrganizationId = ORG_A;
    const controller = createWorkspaceSessionController({
      queryClient,
      authClient: {},
      fetchSession: async () => ({
        user: { id: USER_A },
        session: { activeOrganizationId: ORG_B },
      }),
      switchOrganization: async (organizationId) => {
        activeOrganizationId = organizationId;
        return { id: organizationId };
      },
    });

    await controller.hydrateFromSession({
      user: { id: USER_A },
      session: { activeOrganizationId: ORG_A },
    });

    await controller.switchWorkspace(ORG_B);

    assert.equal(activeOrganizationId, ORG_B);
    assert.deepEqual(readWorkspaceContext(), { organizationId: ORG_B, userId: USER_A });
    assert.equal(readProjectContext().projectId, null);
    assert.ok(queryClient.calls.some(([op]) => op === 'remove'));
    assert.ok(
      queryClient.calls.some(
        ([op, key]) => op === 'invalidate' && key[2] === ORG_B
      )
    );
  } finally {
    uninstallBrowserGlobals();
  }
});

test('project switch invalidates project-scoped queries only', async () => {
  installBrowserGlobals();
  try {
    publishWorkspaceContext({ organizationId: ORG_A, userId: USER_A });

    const queryClient = createMockQueryClient();
    const controller = createWorkspaceSessionController({
      queryClient,
      authClient: {},
      fetchSession: async () => null,
      switchOrganization: async () => null,
    });

    await controller.hydrateFromSession({
      user: { id: USER_A },
      session: { activeOrganizationId: ORG_A },
    });
    queryClient.calls.length = 0;

    await controller.switchProject(PROJECT_B);

    assert.deepEqual(readProjectContext().projectId, PROJECT_B);
    assert.deepEqual(queryClient.calls.at(-1), [
      'invalidate',
      [...dynaxisQueryKeys.workspace(ORG_A), 'project', PROJECT_B],
    ]);
  } finally {
    uninstallBrowserGlobals();
  }
});

test('workspace cache reset prevents cross-workspace query reuse', async () => {
  const queryClient = createMockQueryClient();
  await onWorkspaceContextChanged(queryClient, {
    organizationId: ORG_B,
    previousOrganizationId: ORG_A,
  });

  assert.deepEqual(queryClient.calls[0], ['remove', dynaxisQueryKeys.all]);
  assert.deepEqual(queryClient.calls[1], ['invalidate', dynaxisQueryKeys.workspace(ORG_B)]);
  assert.deepEqual(queryClient.calls[2], ['cancel', dynaxisQueryKeys.workspace(ORG_A)]);
  assert.notDeepEqual(
    dynaxisQueryKeys.projects.all(ORG_A),
    dynaxisQueryKeys.projects.all(ORG_B)
  );
});

test('missing session clears workspace and project context safely', async () => {
  installBrowserGlobals();
  try {
    publishWorkspaceContext({ organizationId: ORG_A, userId: USER_A });
    publishProjectContext({ projectId: PROJECT_A });

    const queryClient = createMockQueryClient();
    const controller = createWorkspaceSessionController({
      queryClient,
      authClient: {},
      fetchSession: async () => null,
      switchOrganization: async () => null,
    });

    await controller.clearSessionContext();

    assert.deepEqual(readWorkspaceContext(), { organizationId: null, userId: null });
    assert.equal(readProjectContext().projectId, null);
    assert.deepEqual(controller.readState(), {
      organizationId: null,
      userId: null,
      projectId: null,
      hasSession: false,
    });
    assert.ok(queryClient.calls.some(([op]) => op === 'remove'));
  } finally {
    uninstallBrowserGlobals();
  }
});

test('controller subscribers receive workspace switch updates', async () => {
  installBrowserGlobals();
  try {
    const queryClient = createMockQueryClient();
    const controller = createWorkspaceSessionController({
      queryClient,
      authClient: {},
      fetchSession: async () => ({
        user: { id: USER_A },
        session: { activeOrganizationId: ORG_B },
      }),
      switchOrganization: async () => ({ id: ORG_B }),
    });

    const seen = [];
    controller.subscribe((state) => seen.push({ ...state }));

    await controller.switchWorkspace(ORG_B);

    assert.ok(seen.some((state) => state.organizationId === ORG_B && state.projectId === null));
  } finally {
    uninstallBrowserGlobals();
  }
});
