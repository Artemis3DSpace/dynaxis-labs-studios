import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DYNAXIS_PERMISSIONS,
  DYNAXIS_PERMISSION_NAMES,
  getPermissionDefinition,
  isDynaxisPermission,
} from '../lib/dynaxis/auth/permissions.js';
import {
  ALLOW,
  EXPLICIT_DENY,
  INSUFFICIENT_WORKSPACE_ROLE,
  NO_PRINCIPAL,
  NO_PROJECT,
  NO_WORKSPACE,
  NOT_PROJECT_MEMBER,
  NOT_WORKSPACE_MEMBER,
  UNKNOWN_PERMISSION,
  UNSUPPORTED_PRINCIPAL,
  authorizeDynaxis,
} from '../lib/dynaxis/auth/policy.js';
import {
  normalizeWorkspaceAccess,
  parseWorkspaceRole,
} from '../lib/dynaxis/auth/workspace-access.js';

const HUMAN = Object.freeze({
  type: 'human',
  principalId: 'principal-user-1',
  userId: 'user-1',
  authMethod: 'session',
});

function workspace(role, overrides = {}) {
  return {
    organizationId: 'org-1',
    role,
    isMember: true,
    ...overrides,
  };
}

function authorize(permission, overrides = {}) {
  return authorizeDynaxis({
    principal: HUMAN,
    permission,
    workspace: workspace('owner'),
    ...overrides,
  });
}

test('permission registry exports canonical permission metadata', () => {
  assert.ok(Object.isFrozen(DYNAXIS_PERMISSIONS));
  assert.ok(Object.isFrozen(DYNAXIS_PERMISSION_NAMES));
  assert.ok(isDynaxisPermission('workspace.read'));
  assert.ok(isDynaxisPermission('character.create'));
  assert.ok(isDynaxisPermission('project.read'));
  assert.equal(isDynaxisPermission('workspace.fly'), false);

  const definition = getPermissionDefinition('workspace.members.invite');
  assert.equal(definition.domain, 'workspace');
  assert.equal(definition.requiredWorkspace, true);
  assert.equal(definition.workspaceMembershipRequired, true);
  assert.equal(definition.requiredProject, false);
  assert.equal(definition.policyLayer, 'workspace');
  assert.deepEqual(definition.allowedPrincipalTypes, ['human']);
  assert.deepEqual(definition.workspaceRoles, ['owner', 'admin']);
  assert.equal(getPermissionDefinition('workspace.fly'), null);
});

test('workspace role matrix is deterministic for Workspace-owned policy', () => {
  const cases = [
    ['owner', 'workspace.transfer', ALLOW],
    ['admin', 'workspace.transfer', INSUFFICIENT_WORKSPACE_ROLE],
    ['admin', 'workspace.members.invite', ALLOW],
    ['member', 'workspace.members.invite', INSUFFICIENT_WORKSPACE_ROLE],
    ['member', 'character.create', ALLOW],
    ['viewer', 'character.create', INSUFFICIENT_WORKSPACE_ROLE],
    ['viewer', 'character.read', ALLOW],
    ['admin', 'audit.read', ALLOW],
    ['member', 'audit.read', INSUFFICIENT_WORKSPACE_ROLE],
    ['viewer', 'settings.read', ALLOW],
    ['viewer', 'settings.manage', INSUFFICIENT_WORKSPACE_ROLE],
  ];

  for (const [role, permission, reason] of cases) {
    const decision = authorize(permission, { workspace: workspace(role) });
    assert.equal(decision.reason, reason, `${role} ${permission}`);
    assert.equal(decision.allowed, reason === ALLOW, `${role} ${permission}`);
    if (reason === ALLOW) {
      assert.equal(decision.matchedPolicy, 'workspace');
    }
  }
});

test('authorization preserves stable denial precedence', () => {
  assert.equal(authorizeDynaxis({ permission: 'not.real', principal: null }).reason, UNKNOWN_PERMISSION);
  assert.equal(authorizeDynaxis({ permission: 'workspace.read', principal: null }).reason, NO_PRINCIPAL);
  assert.equal(
    authorizeDynaxis({
      permission: 'workspace.read',
      principal: { type: 'human', principalId: 'p1', userId: 'u1', authMethod: 'api-key' },
    }).reason,
    UNSUPPORTED_PRINCIPAL
  );
  assert.equal(authorizeDynaxis({ permission: 'workspace.read', principal: HUMAN }).reason, NO_WORKSPACE);
  assert.equal(
    authorize('workspace.read', { workspace: workspace(undefined, { isMember: false }) }).reason,
    NOT_WORKSPACE_MEMBER
  );
  assert.equal(
    authorize('workspace.transfer', { workspace: workspace('admin') }).reason,
    INSUFFICIENT_WORKSPACE_ROLE
  );
  assert.equal(authorize('project.read').reason, NO_PROJECT);
  assert.equal(
    authorize('project.read', {
      project: { projectId: 'project-1', organizationId: 'org-1', isMember: false },
    }).reason,
    NOT_PROJECT_MEMBER
  );
});

test('Project and resource-inherited policies deny by default after earlier gates pass', () => {
  const projectDecision = authorize('project.read', {
    project: { projectId: 'project-1', organizationId: 'org-1', isMember: true, role: 'owner' },
  });
  assert.equal(projectDecision.allowed, false);
  assert.equal(projectDecision.reason, EXPLICIT_DENY);
  assert.equal(projectDecision.matchedPolicy, 'project');

  const resourceDecision = authorize('asset.read', {
    project: { projectId: 'project-1', organizationId: 'org-1', isMember: true, role: 'owner' },
    resource: { type: 'asset', id: 'asset-1', organizationId: 'org-1', projectId: 'project-1' },
  });
  assert.equal(resourceDecision.allowed, false);
  assert.equal(resourceDecision.reason, EXPLICIT_DENY);
  assert.equal(resourceDecision.matchedPolicy, 'resource-inheritance');
});

test('Workspace access adapter does not treat stale active organization as membership', () => {
  const access = normalizeWorkspaceAccess({
    session: { activeOrganizationId: 'org-1' },
    member: { organizationId: 'org-2', userId: 'user-1', role: 'owner' },
  });
  assert.deepEqual(access, {
    organizationId: 'org-1',
    role: undefined,
    isMember: false,
    isPersonal: false,
  });

  assert.equal(authorize('workspace.read', { workspace: access }).reason, NOT_WORKSPACE_MEMBER);
});

test('Workspace access adapter preserves valid Better Auth membership role', () => {
  assert.equal(parseWorkspaceRole('viewer,member'), 'member');
  assert.equal(parseWorkspaceRole('unknown'), null);

  const access = normalizeWorkspaceAccess({
    session: { activeOrganizationId: 'org-1' },
    member: { organizationId: 'org-1', userId: 'user-1', role: 'admin,member' },
    personalWorkspace: { organizationId: 'org-1', userId: 'user-1' },
  });
  assert.deepEqual(access, {
    organizationId: 'org-1',
    role: 'admin',
    isMember: true,
    isPersonal: true,
  });
  assert.equal(authorize('workspace.update', { workspace: access }).reason, ALLOW);
});
