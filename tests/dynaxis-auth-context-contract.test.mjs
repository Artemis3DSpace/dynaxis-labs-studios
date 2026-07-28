import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOW,
  INSUFFICIENT_PROJECT_ROLE,
  INSUFFICIENT_WORKSPACE_ROLE,
  NO_WORKSPACE,
  NOT_PROJECT_MEMBER,
  UNSUPPORTED_PRINCIPAL,
} from '../lib/dynaxis/auth/policy.js';
import {
  AUTH_CONTEXT_ERROR_CODES,
  AUTH_CONTEXT_SUBJECT_TYPES,
  assertAuthContextPermission,
  assertSupportedAuthSubjectInput,
  checkAuthContextPermission,
  createAnonymousAuthContext,
  createAuthContextFromSubject,
  createLegacyAuthContextFromRequest,
  createServiceAccountAuthContext,
  createUserAuthContextFromSession,
  loadAuthContextFromRequest,
  requireAuthContextProject,
  requireAuthContextWorkspace,
  resolveAuthContextProject,
} from '../lib/dynaxis/auth/auth-context.js';
import { loadDynaxisAuthContext } from '../lib/dynaxis/auth/server.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { resolveActiveSessionWorkspace } from '../lib/dynaxis/identity/session-workspace.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ORG_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';

function sessionPayload(overrides = {}) {
  return {
    session: {
      id: SESSION_ID,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      token: 'raw-session-token-must-not-project',
      ...overrides.session,
    },
    user: {
      id: USER_ID,
      email: 'sotira@example.test',
      name: 'Sotira',
      ...overrides.user,
    },
  };
}

function workspace(overrides = {}) {
  return {
    organizationId: ORG_ID,
    role: 'owner',
    isMember: true,
    isPersonal: false,
    name: 'Dynaxis',
    slug: 'dynaxis',
    ...overrides,
  };
}

function createProjectMembershipService({ role = 'owner', row = undefined } = {}) {
  return {
    calls: [],
    async get(input) {
      this.calls.push(input);
      if (row !== undefined) return row;
      return {
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
        role,
      };
    },
  };
}

test('authenticated Better Auth session creates sanitized user AuthContext with active Workspace', async () => {
  const context = await createUserAuthContextFromSession(sessionPayload(), {
    workspaceResolver: async () => workspace({ role: 'admin' }),
  });

  assert.equal(context.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(context.subject.userId, USER_ID);
  assert.equal(context.principal.type, 'human');
  assert.equal(context.principal.principalId, `user:${USER_ID}`);
  assert.equal(context.session.sessionId, SESSION_ID);
  assert.equal(context.session.activeOrganizationId, ORG_ID);
  assert.equal(context.session.token, undefined);
  assert.deepEqual(context.workspace, {
    organizationId: ORG_ID,
    role: 'admin',
    isMember: true,
    isPersonal: false,
    name: 'Dynaxis',
    slug: 'dynaxis',
  });

  const decision = await checkAuthContextPermission(context, 'workspace.update');
  assert.equal(decision.reason, ALLOW);
  assert.equal(decision.matchedPolicy, 'workspace');
});

test('active session Workspace resolver uses active organization membership only', async () => {
  const repository = {
    async findActiveOrganization(organizationId) {
      assert.equal(organizationId, ORG_ID);
      return { id: ORG_ID, name: 'Dynaxis', slug: 'dynaxis' };
    },
    async findMembership({ organizationId, userId }) {
      assert.deepEqual({ organizationId, userId }, { organizationId: ORG_ID, userId: USER_ID });
      return { organizationId: ORG_ID, userId: USER_ID, role: 'admin,member' };
    },
    async findPersonalWorkspace(organizationId) {
      assert.equal(organizationId, ORG_ID);
      return { organizationId: ORG_ID, userId: USER_ID };
    },
  };

  const resolved = await resolveActiveSessionWorkspace(sessionPayload(), { repository });
  assert.deepEqual(resolved, {
    organizationId: ORG_ID,
    role: 'admin',
    isMember: true,
    isPersonal: true,
    name: 'Dynaxis',
    slug: 'dynaxis',
  });

  const missing = await resolveActiveSessionWorkspace(
    sessionPayload({ session: { activeOrganizationId: null } }),
    { repository }
  );
  assert.equal(missing, null);
});

test('session loader preserves user subject but denies Workspace permissions when active Workspace is missing', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/projects');
  const context = await loadAuthContextFromRequest(request, {
    sessionLoader: async () => sessionPayload({ session: { activeOrganizationId: null } }),
    workspaceResolver: async () => null,
  });

  assert.equal(context.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(context.workspace, null);
  assert.throws(
    () => requireAuthContextWorkspace(context),
    (err) => err.code === AUTH_CONTEXT_ERROR_CODES.WORKSPACE_REQUIRED
  );

  const decision = await checkAuthContextPermission(context, 'workspace.read');
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NO_WORKSPACE);
});

test('default Better Auth loader and server wrapper pass request headers into canonical AuthContext', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: { cookie: 'better-auth.session_token=session-token' },
  });
  const auth = {
    api: {
      calls: [],
      async getSession(input) {
        this.calls.push(input);
        assert.equal(input.headers, request.headers);
        return sessionPayload();
      },
    },
  };

  const context = await loadDynaxisAuthContext(request, {
    auth,
    workspaceResolver: async () => workspace({ role: 'admin' }),
  });

  assert.equal(context.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(context.principal.type, 'human');
  assert.equal(context.workspace.role, 'admin');
  assert.equal(auth.api.calls.length, 1);
});

test('legacy x-api-key is ignored by default when compatibility is not enabled', async () => {
  const rawKey = 'MUAPI_ROUTE_KEY_NOT_CANONICAL';
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: { 'x-api-key': rawKey },
  });

  const context = await loadAuthContextFromRequest(request, {
    sessionLoader: async () => null,
  });

  assert.equal(context.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.ANONYMOUS);
  assert.equal(context.principal, null);
  assert.equal(context.compatibility, null);
  assert.doesNotMatch(JSON.stringify(context), new RegExp(rawKey));
});

test('legacy x-api-key compatibility projects ownerRef without exposing the raw key', async () => {
  const rawKey = 'MUAPI_SECRET_DO_NOT_SERIALIZE';
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: { 'x-api-key': rawKey },
  });
  const context = createLegacyAuthContextFromRequest(request);
  const ownerRef = ownerRefFromApiKey(rawKey);

  assert.equal(context.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.LEGACY);
  assert.equal(context.subject.legacyOwnerRef, ownerRef);
  assert.equal(context.principal.type, 'legacy');
  assert.equal(context.principal.authMethod, 'legacy-muapi-key');
  assert.equal(context.compatibility.mode, 'legacy-owner-ref-route');
  assert.equal(context.compatibility.ownerRef, ownerRef);
  assert.doesNotMatch(JSON.stringify(context), new RegExp(rawKey));

  const loaded = await loadAuthContextFromRequest(request, {
    sessionLoader: async () => null,
    legacyCompatibility: true,
  });
  assert.equal(loaded.subject.legacyOwnerRef, ownerRef);
});

test('project resolution uses canonical Project membership and permission helpers', async () => {
  const context = await createUserAuthContextFromSession(sessionPayload(), {
    workspaceResolver: async () => workspace(),
  });
  const projectMembershipService = createProjectMembershipService({ role: 'editor' });
  const withProject = await resolveAuthContextProject(context, {
    projectId: PROJECT_ID,
    projectMembershipService,
  });

  assert.deepEqual(withProject.project, {
    projectId: PROJECT_ID,
    organizationId: ORG_ID,
    role: 'editor',
    isMember: true,
  });
  assert.deepEqual(projectMembershipService.calls[0], {
    projectId: PROJECT_ID,
    organizationId: ORG_ID,
    userId: USER_ID,
  });

  const updateDecision = await checkAuthContextPermission(withProject, 'project.update', {
    projectMembershipService,
  });
  assert.equal(updateDecision.reason, ALLOW);
  assert.equal(updateDecision.matchedPolicy, 'project');

  const archiveDecision = await checkAuthContextPermission(withProject, 'project.archive', {
    projectMembershipService,
  });
  assert.equal(archiveDecision.reason, INSUFFICIENT_PROJECT_ROLE);
  assert.equal(archiveDecision.allowed, false);

  const createDecision = await checkAuthContextPermission(withProject, 'asset.create', {
    projectMembershipService,
  });
  assert.equal(createDecision.reason, ALLOW);
  assert.equal(createDecision.matchedPolicy, 'resource-inheritance');

  const designCreateDecision = await checkAuthContextPermission(withProject, 'design.create', {
    projectMembershipService,
  });
  assert.equal(designCreateDecision.reason, ALLOW);
  assert.equal(designCreateDecision.matchedPolicy, 'resource-inheritance');
});

test('project resolution preserves missing membership as AuthContext Project denial', async () => {
  const context = await createUserAuthContextFromSession(sessionPayload(), {
    workspaceResolver: async () => workspace(),
  });
  const projectMembershipService = createProjectMembershipService({ row: null });
  const withProject = await resolveAuthContextProject(context, {
    projectId: PROJECT_ID,
    projectMembershipService,
  });

  assert.deepEqual(withProject.project, {
    projectId: PROJECT_ID,
    organizationId: ORG_ID,
    isMember: false,
  });

  const decision = await checkAuthContextPermission(withProject, 'project.read', {
    projectMembershipService,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NOT_PROJECT_MEMBER);
});

test('anonymous, legacy, user, and service-account subjects remain distinct', async () => {
  const anonymous = createAnonymousAuthContext();
  const legacy = createLegacyAuthContextFromRequest(
    new Request('https://dynaxis.test', { headers: { 'x-api-key': 'legacy-key' } })
  );
  const user = await createUserAuthContextFromSession(sessionPayload(), {
    workspaceResolver: async () => workspace(),
  });
  const service = createServiceAccountAuthContext({ serviceAccountId: 'internal-worker' });

  assert.equal(anonymous.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.ANONYMOUS);
  assert.equal(anonymous.principal, null);
  assert.equal(legacy.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.LEGACY);
  assert.equal(legacy.principal.type, 'legacy');
  assert.equal(user.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(user.principal.type, 'human');
  assert.equal(service.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.SERVICE_ACCOUNT);
  assert.equal(service.principal.type, 'service');

  const decision = await checkAuthContextPermission(
    { ...service, workspace: workspace() },
    'workspace.read'
  );
  assert.equal(decision.reason, UNSUPPORTED_PRINCIPAL);
});

test('provider credentials, model accounts, and worker adapters are rejected as identity subjects', () => {
  for (const type of ['provider-credential', 'model-account', 'worker-adapter']) {
    assert.throws(
      () => assertSupportedAuthSubjectInput({ type, token: 'secret' }),
      (err) => {
        assert.equal(err.code, AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT);
        assert.doesNotMatch(JSON.stringify(err), /secret/);
        return true;
      },
      type
    );
    assert.throws(
      () => createAuthContextFromSubject({ type, token: 'secret' }),
      (err) => err.code === AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT,
      type
    );
  }
});

test('typed AuthContext helpers require Project context and raise permission denials with decisions', async () => {
  const context = await createUserAuthContextFromSession(sessionPayload(), {
    workspaceResolver: async () => workspace({ role: 'viewer' }),
  });

  assert.throws(
    () => requireAuthContextProject(context),
    (err) => err.code === AUTH_CONTEXT_ERROR_CODES.PROJECT_REQUIRED
  );

  await assert.rejects(
    assertAuthContextPermission(context, 'workspace.update'),
    (err) => {
      assert.equal(err.code, AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED);
      assert.equal(err.decision.reason, INSUFFICIENT_WORKSPACE_ROLE);
      return true;
    }
  );

  assert.equal(requireAuthContextWorkspace(context).organizationId, ORG_ID);

  const readDecision = await checkAuthContextPermission(context, 'character.read', {
    resource: { type: 'character', id: 'character-1', organizationId: ORG_ID },
  });
  assert.equal(readDecision.reason, ALLOW);
  assert.equal(readDecision.matchedPolicy, 'workspace');
});
