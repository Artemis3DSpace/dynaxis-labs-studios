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
  LEGACY_OWNERSHIP_UNRESOLVED,
  NO_PRINCIPAL,
  NO_PROJECT,
  NO_WORKSPACE,
  NOT_PROJECT_MEMBER,
  NOT_WORKSPACE_MEMBER,
  OWNERSHIP_CONFLICT,
  RESOURCE_SCOPE_MISMATCH,
  UNKNOWN_PERMISSION,
  UNSUPPORTED_PRINCIPAL,
  authorizeDynaxis,
} from '../lib/dynaxis/auth/policy.js';
import {
  normalizeWorkspaceAccess,
  parseWorkspaceRole,
} from '../lib/dynaxis/auth/workspace-access.js';

const WORKSPACE_ROLES = Object.freeze(['owner', 'admin', 'member', 'viewer']);
const HUMAN = Object.freeze({
  type: 'human',
  principalId: 'principal-user-1',
  userId: 'user-1',
  authMethod: 'session',
});
const HUMAN_OAUTH = Object.freeze({
  ...HUMAN,
  principalId: 'principal-oauth-1',
  authMethod: 'oauth-token',
});
const LEGACY = Object.freeze({
  type: 'legacy',
  legacyOwnerRef: 'ak_sha256:claimed',
  authMethod: 'legacy-muapi-key',
});

function workspace(role = 'owner', overrides = {}) {
  return {
    organizationId: 'org-1',
    role,
    isMember: true,
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
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

function publicDecision(decision) {
  return JSON.stringify(decision);
}

test('permission registry exports canonical immutable permission metadata', () => {
  assert.ok(Object.isFrozen(DYNAXIS_PERMISSIONS));
  assert.ok(Object.isFrozen(DYNAXIS_PERMISSION_NAMES));
  assert.equal(DYNAXIS_PERMISSION_NAMES.length, 75);
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
  assert.equal(definition.scopeMode, 'workspace');
  assert.deepEqual(definition.allowedPrincipalTypes, ['human']);
  assert.deepEqual(definition.workspaceRoles, ['owner', 'admin']);
  assert.equal(getPermissionDefinition('workspace.fly'), null);

  assert.equal(getPermissionDefinition('design.update').scopeMode, 'workspace-or-project');
  assert.equal(getPermissionDefinition('settings.read').scopeMode, 'workspace-or-project');
  assert.equal(getPermissionDefinition('settings.manage').scopeMode, 'workspace-or-project');
});

test('Workspace policy matrix matches the permission registry', () => {
  const workspacePolicyPermissions = Object.values(DYNAXIS_PERMISSIONS).filter(
    (definition) =>
      definition.policyLayer === 'workspace' &&
      (definition.scopeMode === 'workspace' || definition.scopeMode === 'workspace-or-project')
  );
  assert.equal(workspacePolicyPermissions.length, 46);

  for (const definition of workspacePolicyPermissions) {
    for (const role of WORKSPACE_ROLES) {
      const decision = authorize(definition.name, { workspace: workspace(role) });
      const expectedAllowed = definition.workspaceRoles.includes(role);
      assert.equal(
        decision.allowed,
        expectedAllowed,
        `${definition.name} ${role} allowed=${expectedAllowed}`
      );
      assert.equal(
        decision.reason,
        expectedAllowed ? ALLOW : INSUFFICIENT_WORKSPACE_ROLE,
        `${definition.name} ${role}`
      );
      assert.equal(decision.matchedPolicy, 'workspace', `${definition.name} ${role}`);
    }
  }
});

test('Workspace matrix covers canonical Workspace-owned domains', () => {
  for (const prefix of [
    'workspace.',
    'character.',
    'product.',
    'brand.',
    'design_template.',
    'design_component.',
    'design_system.',
    'design_component_set.',
    'design.',
  ]) {
    assert.ok(
      DYNAXIS_PERMISSION_NAMES.some((permission) => permission.startsWith(prefix)),
      `registry includes ${prefix}`
    );
  }
  assert.ok(isDynaxisPermission('audit.read'));
  assert.ok(isDynaxisPermission('settings.read'));
  assert.ok(isDynaxisPermission('settings.manage'));
});

test('human session and oauth-token principals can receive Workspace grants', () => {
  assert.equal(authorize('workspace.read', { principal: HUMAN }).reason, ALLOW);
  assert.equal(authorize('workspace.read', { principal: HUMAN_OAUTH }).reason, ALLOW);
});

test('unsupported and future principals remain ungranted', () => {
  const cases = [
    [null, NO_PRINCIPAL],
    [{ type: 'human', principalId: 'p1', userId: 'u1', authMethod: 'api-key' }, UNSUPPORTED_PRINCIPAL],
    [{ type: 'api-key', principalId: 'api-key-1', authMethod: 'api-key' }, UNSUPPORTED_PRINCIPAL],
    [{ type: 'service', principalId: 'svc-1', authMethod: 'internal' }, UNSUPPORTED_PRINCIPAL],
    [{ type: 'provider-credential', provider: 'muapi', authMethod: 'api-key' }, UNSUPPORTED_PRINCIPAL],
  ];

  for (const [principal, reason] of cases) {
    assert.equal(authorize('workspace.read', { principal }).reason, reason);
  }
});

test('normalized legacy compatibility is deny-by-default unless resolved by explicit context', () => {
  assert.equal(
    authorize('workspace.read', {
      principal: LEGACY,
      workspace: workspace('owner', { isMember: false }),
    }).reason,
    NOT_WORKSPACE_MEMBER
  );
  assert.equal(
    authorize('character.read', {
      principal: LEGACY,
      workspace: workspace('owner'),
      resource: { type: 'character', id: 'character-1', organizationId: 'org-1' },
    }).reason,
    LEGACY_OWNERSHIP_UNRESOLVED
  );
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

test('personal Workspace governance mutations are explicitly denied for owners', () => {
  for (const permission of [
    'workspace.members.invite',
    'workspace.members.update',
    'workspace.members.remove',
    'workspace.transfer',
  ]) {
    const decision = authorize(permission, {
      workspace: workspace('owner', { isPersonal: true }),
    });
    assert.equal(decision.allowed, false, permission);
    assert.equal(decision.reason, EXPLICIT_DENY, permission);
    assert.equal(decision.matchedPolicy, 'workspace', permission);
  }

  assert.equal(
    authorize('workspace.read', { workspace: workspace('owner', { isPersonal: true }) }).reason,
    ALLOW
  );
});

test('Workspace roles do not imply Project roles', () => {
  assert.equal(authorize('project.read').reason, NO_PROJECT);
  assert.equal(
    authorize('project.read', {
      workspace: workspace('owner'),
      project: project({ isMember: true }),
    }).reason,
    EXPLICIT_DENY
  );
  assert.equal(
    authorize('project.update', {
      workspace: workspace('admin'),
      project: project({ isMember: true }),
    }).reason,
    EXPLICIT_DENY
  );
});

test('Base evaluator leaves Project and inherited-resource grants to WP-7C-10 adapters', () => {
  assert.equal(
    authorize('project.read', {
      project: project({ isMember: false }),
    }).reason,
    NOT_PROJECT_MEMBER
  );

  const projectDecision = authorize('project.read', { project: project() });
  assert.equal(projectDecision.allowed, false);
  assert.equal(projectDecision.reason, EXPLICIT_DENY);
  assert.equal(projectDecision.matchedPolicy, 'project');

  const resourceDecision = authorize('asset.read', {
    project: project(),
    resource: { type: 'asset', id: 'asset-1', organizationId: 'org-1', projectId: 'project-1' },
  });
  assert.equal(resourceDecision.allowed, false);
  assert.equal(resourceDecision.reason, EXPLICIT_DENY);
  assert.equal(resourceDecision.matchedPolicy, 'resource-inheritance');
});

test('Project-scoped Design never grants from Workspace role', () => {
  assert.equal(
    authorize('design.update', {
      workspace: workspace('owner'),
      project: project(),
      resource: { type: 'design', id: 'design-1', organizationId: 'org-1', projectId: 'project-1' },
    }).reason,
    EXPLICIT_DENY
  );
  assert.equal(
    authorize('design.create', {
      workspace: workspace('member'),
      project: project(),
    }).reason,
    EXPLICIT_DENY
  );
  assert.equal(
    authorize('design.update', {
      workspace: workspace('member'),
      resource: { type: 'design', id: 'design-1', organizationId: 'org-1' },
    }).reason,
    ALLOW
  );
  assert.equal(
    authorize('design.update', {
      workspace: workspace('owner'),
      resource: { type: 'design', id: 'design-1', organizationId: 'org-1', projectId: 'project-1' },
    }).reason,
    NO_PROJECT
  );
});

test('Workspace-scoped settings follow the canonical Workspace role matrix', () => {
  const cases = [
    ['settings.read', 'owner', ALLOW],
    ['settings.read', 'admin', ALLOW],
    ['settings.read', 'member', ALLOW],
    ['settings.read', 'viewer', ALLOW],
    ['settings.manage', 'owner', ALLOW],
    ['settings.manage', 'admin', ALLOW],
    ['settings.manage', 'member', INSUFFICIENT_WORKSPACE_ROLE],
    ['settings.manage', 'viewer', INSUFFICIENT_WORKSPACE_ROLE],
  ];

  for (const [permission, role, reason] of cases) {
    const decision = authorize(permission, { workspace: workspace(role) });
    assert.equal(decision.reason, reason, `${permission} ${role}`);
    assert.equal(decision.allowed, reason === ALLOW, `${permission} ${role}`);
    assert.equal(decision.matchedPolicy, 'workspace', `${permission} ${role}`);
  }
});

test('Project-scoped settings never grant from Workspace role in the base evaluator', () => {
  const readDecision = authorize('settings.read', {
    workspace: workspace('owner'),
    project: project(),
    resource: { type: 'settings', id: 'settings-1', organizationId: 'org-1', projectId: 'project-1' },
  });
  assert.equal(readDecision.allowed, false);
  assert.equal(readDecision.reason, EXPLICIT_DENY);
  assert.equal(readDecision.matchedPolicy, 'project');

  const manageDecision = authorize('settings.manage', {
    workspace: workspace('admin'),
    project: project(),
  });
  assert.equal(manageDecision.allowed, false);
  assert.equal(manageDecision.reason, EXPLICIT_DENY);
  assert.equal(manageDecision.matchedPolicy, 'project');

  const missingReadProject = authorize('settings.read', {
    workspace: workspace('owner'),
    resource: { type: 'settings', id: 'settings-1', organizationId: 'org-1', projectId: 'project-1' },
  });
  assert.equal(missingReadProject.reason, NO_PROJECT);

  const missingManageProject = authorize('settings.manage', {
    workspace: workspace('admin'),
    resource: { type: 'settings', id: 'settings-1', organizationId: 'org-1', projectId: 'project-1' },
  });
  assert.equal(missingManageProject.reason, NO_PROJECT);
});

test('authorization decisions do not echo sensitive input fields', () => {
  const decision = authorizeDynaxis({
    principal: HUMAN,
    permission: 'workspace.read',
    workspace: workspace('owner'),
    rawApiKey: 'muapi-secret',
    secret: 'storage-secret',
    providerCredential: { token: 'provider-secret' },
    memberList: [{ userId: 'other-user' }],
    stack: 'internal stack',
  });
  const serialized = publicDecision(decision);
  for (const forbidden of [
    'rawApiKey',
    'muapi-secret',
    'secret',
    'storage-secret',
    'providerCredential',
    'provider-secret',
    'memberList',
    'other-user',
    'stack',
    'internal stack',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test('stable decision precedence is table-driven', () => {
  const cases = [
    ['unknown permission', { permission: 'not.real', principal: null }, UNKNOWN_PERMISSION],
    ['missing principal', { permission: 'workspace.read', principal: null }, NO_PRINCIPAL],
    [
      'unsupported principal',
      {
        permission: 'workspace.read',
        principal: { type: 'human', principalId: 'p1', userId: 'u1', authMethod: 'api-key' },
      },
      UNSUPPORTED_PRINCIPAL,
    ],
    ['missing Workspace', { permission: 'workspace.read', principal: HUMAN }, NO_WORKSPACE],
    [
      'not Workspace member',
      {
        permission: 'workspace.read',
        principal: HUMAN,
        workspace: workspace('owner', { isMember: false }),
      },
      NOT_WORKSPACE_MEMBER,
    ],
    [
      'insufficient Workspace role',
      {
        permission: 'workspace.transfer',
        principal: HUMAN,
        workspace: workspace('admin'),
      },
      INSUFFICIENT_WORKSPACE_ROLE,
    ],
    [
      'missing Project',
      {
        permission: 'project.read',
        principal: HUMAN,
        workspace: workspace('owner'),
      },
      NO_PROJECT,
    ],
    [
      'not Project member',
      {
        permission: 'project.read',
        principal: HUMAN,
        workspace: workspace('owner'),
        project: project({ isMember: false }),
      },
      NOT_PROJECT_MEMBER,
    ],
    [
      'legacy unresolved',
      {
        permission: 'character.read',
        principal: LEGACY,
        workspace: workspace('owner'),
        resource: { type: 'character', id: 'character-1', organizationId: 'org-1' },
      },
      LEGACY_OWNERSHIP_UNRESOLVED,
    ],
    [
      'ownership conflict',
      {
        permission: 'character.read',
        principal: HUMAN,
        workspace: workspace('owner'),
        resource: {
          type: 'character',
          id: 'character-1',
          organizationId: 'org-1',
          ownershipConflict: true,
        },
      },
      OWNERSHIP_CONFLICT,
    ],
    [
      'resource scope mismatch',
      {
        permission: 'character.read',
        principal: HUMAN,
        workspace: workspace('owner'),
        resource: { type: 'character', id: 'character-1', organizationId: 'org-2' },
      },
      RESOURCE_SCOPE_MISMATCH,
    ],
    [
      'explicit deny',
      {
        permission: 'workspace.read',
        principal: HUMAN,
        workspace: workspace('owner'),
        explicitDeny: true,
      },
      EXPLICIT_DENY,
    ],
    [
      'allow',
      {
        permission: 'workspace.read',
        principal: HUMAN,
        workspace: workspace('owner'),
      },
      ALLOW,
    ],
  ];

  for (const [label, input, reason] of cases) {
    assert.equal(authorizeDynaxis(input).reason, reason, label);
  }
});
