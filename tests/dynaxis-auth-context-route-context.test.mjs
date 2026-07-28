import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  loadRouteAuthContext,
  requireRoutePermission,
  resolveRouteProject,
  withAuthContextRoute,
} from '../lib/dynaxis/auth/route-context.js';
import {
  AUTH_CONTEXT_SUBJECT_TYPES,
  AuthContextError,
  AUTH_CONTEXT_ERROR_CODES,
} from '../lib/dynaxis/auth/auth-context.js';
import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES as API_ROUTE_AUTH_ERROR_CODES,
  jsonError,
  withAuthContextRoute as withApiAuthContextRoute,
} from '../lib/dynaxis/api.js';
import * as dynaxisApi from '../lib/dynaxis/api.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ORG_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';

function sessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      token: 'raw-session-token-must-not-project',
    },
    user: {
      id: USER_ID,
      email: 'sotira@example.test',
    },
  };
}

function workspace(overrides = {}) {
  return {
    organizationId: ORG_ID,
    role: 'admin',
    isMember: true,
    isPersonal: false,
    ...overrides,
  };
}

function projectMembershipService(role = 'editor') {
  return {
    calls: [],
    async get(input) {
      this.calls.push(input);
      return {
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
        role,
      };
    },
  };
}

async function responseJson(response) {
  return response.json();
}

test('GET route helper loads AuthContext from Next.js Request without legacy API-key compatibility', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: {
      cookie: 'better-auth.session_token=session-token',
      'x-api-key': 'legacy-key-must-be-ignored',
    },
  });

  const routeContext = await loadRouteAuthContext(request, {
    sessionLoader: async () => sessionPayload(),
    workspaceResolver: async () => workspace({ role: 'owner' }),
  });

  assert.equal(routeContext.method, 'GET');
  assert.equal(routeContext.request, request);
  assert.equal(routeContext.authContext.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(routeContext.authContext.workspace.organizationId, ORG_ID);
  assert.equal(routeContext.legacyCompatibility.enabled, false);
  assert.equal(routeContext.legacyCompatibility.presented, true);
  assert.equal(routeContext.legacyCompatibility.used, false);
  assert.doesNotMatch(JSON.stringify(routeContext.authContext), /legacy-key-must-be-ignored/);
});

test('POST route helper authorizes project-scoped permission through AuthContext', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
  const memberships = projectMembershipService('editor');

  const routeContext = await requireRoutePermission(request, {
    permission: 'asset.create',
    projectId: PROJECT_ID,
    sessionLoader: async () => sessionPayload(),
    workspaceResolver: async () => workspace({ role: 'member' }),
    projectMembershipService: memberships,
  });

  assert.equal(routeContext.method, 'POST');
  assert.equal(routeContext.authContext.project.projectId, PROJECT_ID);
  assert.equal(routeContext.authContext.project.role, 'editor');
  assert.equal(routeContext.authorization.allowed, true);
  assert.equal(routeContext.authorization.matchedPolicy, 'resource-inheritance');
  assert.deepEqual(routeContext.authContext.permissions.project, routeContext.authContext.project);
  assert.deepEqual(routeContext.authContext.permissions.workspace, routeContext.authContext.workspace);
  assert.deepEqual(routeContext.authContext.permissions.principal, routeContext.authContext.principal);
  assert.equal(routeContext.authContext.permissions.session, undefined);
  assert.equal(memberships.calls.length, 1);
  assert.deepEqual(memberships.calls[0], {
    projectId: PROJECT_ID,
    organizationId: ORG_ID,
    userId: USER_ID,
  });
});

test('route Project resolver adapts a Request without duplicate membership lookups', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/projects/project-1');
  const memberships = projectMembershipService('owner');

  const routeContext = await resolveRouteProject(request, {
    projectId: PROJECT_ID,
    sessionLoader: async () => sessionPayload(),
    workspaceResolver: async () => workspace({ role: 'admin' }),
    projectMembershipService: memberships,
  });

  assert.equal(routeContext.authContext.project.projectId, PROJECT_ID);
  assert.equal(routeContext.authContext.project.role, 'owner');
  assert.equal(memberships.calls.length, 1);
});

test('route helper gives Better Auth session precedence over opt-in legacy key compatibility', async () => {
  const rawKey = 'MUAPI_ROUTE_HELPER_SHOULD_NOT_WIN';
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: {
      cookie: 'better-auth.session_token=session-token',
      'x-api-key': rawKey,
    },
  });

  const routeContext = await loadRouteAuthContext(request, {
    legacyCompatibility: true,
    sessionLoader: async () => sessionPayload(),
    workspaceResolver: async () => workspace({ role: 'owner' }),
  });

  assert.equal(routeContext.authContext.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(routeContext.authContext.compatibility, null);
  assert.deepEqual(routeContext.legacyCompatibility, {
    enabled: true,
    presented: true,
    used: false,
    source: 'x-api-key',
  });
  assert.doesNotMatch(JSON.stringify(routeContext), new RegExp(rawKey));
  assert.doesNotMatch(JSON.stringify(routeContext), /ak_sha256/);
});

test('legacy x-api-key route compatibility is explicit and auditable without raw key disclosure', async () => {
  const rawKey = 'MUAPI_ROUTE_HELPER_SECRET';
  const request = new Request('https://dynaxis.test/api/dynaxis/legacy', {
    method: 'POST',
    headers: { 'x-api-key': rawKey },
  });
  const ownerRef = ownerRefFromApiKey(rawKey);

  const response = await withAuthContextRoute(
    request,
    async ({ authContext, legacyCompatibility }) =>
      Response.json({
        subjectType: authContext.subject.type,
        ownerRef: authContext.compatibility.ownerRef,
        audit: legacyCompatibility,
      }),
    {
      legacyCompatibility: true,
      sessionLoader: async () => null,
    }
  );
  const body = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.subjectType, AUTH_CONTEXT_SUBJECT_TYPES.LEGACY);
  assert.equal(body.ownerRef, ownerRef);
  assert.deepEqual(body.audit, {
    enabled: true,
    presented: true,
    used: true,
    source: 'x-api-key',
    mode: 'legacy-owner-ref-route',
    ownerRef,
  });
  assert.doesNotMatch(JSON.stringify(body), new RegExp(rawKey));
});

test('route helper rejects non-boolean legacy compatibility options', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/legacy', {
    headers: { 'x-api-key': 'truthy-string-must-not-enable-legacy' },
  });

  const response = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      legacyCompatibility: 'true',
      requireAuthenticated: false,
      sessionLoader: async () => null,
    }
  );
  const body = await responseJson(response);

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: 'Invalid authorization request',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
  });
  assert.doesNotMatch(JSON.stringify(body), /truthy-string/);
});

test('route helper maps missing AuthContext authentication to standard 401 JSON', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: { 'x-api-key': 'ignored-legacy-key' },
  });
  let handlerCalled = false;

  const response = await withAuthContextRoute(
    request,
    async () => {
      handlerCalled = true;
      return Response.json({ ok: true });
    },
    {
      permission: 'workspace.read',
      sessionLoader: async () => null,
    }
  );
  const body = await responseJson(response);

  assert.equal(handlerCalled, false);
  assert.equal(response.status, 401);
  assert.deepEqual(body, {
    error: 'Authentication required',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
  });
  assert.doesNotMatch(JSON.stringify(body), /ignored-legacy-key/);
});

test('route helper maps anonymous project-scoped permissions to standard 401 JSON', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/assets/asset-1');

  const response = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      permission: 'asset.read',
      projectId: PROJECT_ID,
      resource: { type: 'asset', id: 'asset-1', projectId: PROJECT_ID },
      sessionLoader: async () => null,
    }
  );
  const body = await responseJson(response);

  assert.equal(response.status, 401);
  assert.deepEqual(body, {
    error: 'Authentication required',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
  });
});

test('route helper maps insufficient role to standard 403 JSON', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/workspace', {
    method: 'POST',
  });

  const response = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      permission: 'workspace.update',
      sessionLoader: async () => sessionPayload(),
      workspaceResolver: async () => workspace({ role: 'viewer' }),
    }
  );
  const body = await responseJson(response);

  assert.equal(response.status, 403);
  assert.deepEqual(body, {
    error: 'Forbidden',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.FORBIDDEN,
  });
});

test('route helper maps invalid permission usage and missing Workspace to documented JSON', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/workspace');

  const invalidPermission = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      permission: '   ',
      sessionLoader: async () => sessionPayload(),
      workspaceResolver: async () => workspace({ role: 'owner' }),
    }
  );
  assert.equal(invalidPermission.status, 400);
  assert.deepEqual(await responseJson(invalidPermission), {
    error: 'Invalid authorization request',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
  });

  const missingWorkspace = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      requireWorkspace: true,
      sessionLoader: async () => sessionPayload(),
      workspaceResolver: async () => null,
    }
  );
  assert.equal(missingWorkspace.status, 403);
  assert.deepEqual(await responseJson(missingWorkspace), {
    error: 'Workspace access required',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.WORKSPACE_REQUIRED,
  });
});

test('route helper preserves not-found-shaped authorization denials without scope disclosure', async () => {
  const request = new Request('https://dynaxis.test/api/dynaxis/assets/asset-1');
  const resourceRepository = {
    calls: [],
    async findResource(input) {
      this.calls.push(input);
      return {
        type: 'asset',
        id: input.id,
        projectId: '55555555-5555-4555-8555-555555555555',
      };
    },
  };

  const response = await withAuthContextRoute(
    request,
    async () => Response.json({ ok: true }),
    {
      permission: 'asset.read',
      projectId: PROJECT_ID,
      resourceId: 'asset-1',
      resourceType: 'asset',
      resourceRepository,
      sessionLoader: async () => sessionPayload(),
      workspaceResolver: async () => workspace({ role: 'admin' }),
      projectMembershipService: projectMembershipService('owner'),
    }
  );
  const body = await responseJson(response);

  assert.equal(response.status, 404);
  assert.deepEqual(body, {
    error: 'Not found',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.NOT_FOUND,
  });
  assert.deepEqual(resourceRepository.calls, [{ type: 'asset', id: 'asset-1' }]);
  assert.doesNotMatch(JSON.stringify(body), /RESOURCE_SCOPE_MISMATCH/);
  assert.doesNotMatch(JSON.stringify(body), /55555555/);
});

test('API helper re-exports route helpers and maps AuthContext errors through jsonError', async () => {
  assert.equal(API_ROUTE_AUTH_ERROR_CODES.FORBIDDEN, DYNAXIS_ROUTE_AUTH_ERROR_CODES.FORBIDDEN);
  assert.equal(typeof withApiAuthContextRoute, 'function');
  for (const exportName of [
    'RouteAuthError',
    'isRouteAuthError',
    'jsonRouteAuthError',
    'loadRouteAuthContext',
    'mapRouteAuthError',
    'requireRouteAuthContext',
    'requireRoutePermission',
    'requireRouteProject',
    'requireRouteWorkspace',
    'resolveRouteProject',
    'withAuthContextRoute',
  ]) {
    assert.equal(typeof dynaxisApi[exportName], 'function', exportName);
  }

  const response = jsonError(
    new AuthContextError('AuthContext permission denied', {
      code: AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED,
      status: 403,
    })
  );
  const body = await responseJson(response);

  assert.equal(response.status, 403);
  assert.deepEqual(body, {
    error: 'Forbidden',
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.FORBIDDEN,
  });
});
