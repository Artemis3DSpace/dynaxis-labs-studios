import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOW,
  EXPLICIT_DENY,
  INSUFFICIENT_PROJECT_ROLE,
  LEGACY_OWNERSHIP_UNRESOLVED,
  NO_PROJECT,
  NOT_PROJECT_MEMBER,
  RESOURCE_SCOPE_MISMATCH,
  UNKNOWN_PERMISSION,
  NO_PRINCIPAL,
  UNSUPPORTED_PRINCIPAL,
} from '../lib/dynaxis/auth/policy.js';
import {
  authorizeProjectPolicy,
  getProjectPermissionRoles,
  projectRoleGrantsPermission,
} from '../lib/dynaxis/auth/project-policy.js';
import {
  PROJECT_INHERITED_RESOURCE_TYPES,
  authorizeResourceInheritance,
  resolveResourceInheritance,
} from '../lib/dynaxis/auth/resource-policy.js';
import { PROJECT_MEMBERSHIP_ERROR_CODES } from '../lib/dynaxis/identity/project-membership.js';

const HUMAN = Object.freeze({
  type: 'human',
  principalId: 'principal-user-1',
  userId: 'user-1',
  authMethod: 'session',
});

const PROVIDER_CREDENTIAL = Object.freeze({
  type: 'provider-credential',
  provider: 'muapi',
  authMethod: 'api-key',
  token: 'provider-secret',
});

const LEGACY = Object.freeze({
  type: 'legacy',
  legacyOwnerRef: 'ak_sha256:claimed',
  authMethod: 'legacy-muapi-key',
});

const PROJECT_ROLES = Object.freeze(['owner', 'admin', 'editor', 'viewer']);

function workspace(overrides = {}) {
  return {
    organizationId: 'org-1',
    role: 'owner',
    isMember: true,
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function resource(type, overrides = {}) {
  return {
    type,
    id: `${type}-1`,
    projectId: 'project-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function membership(role = 'owner', overrides = {}) {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
    userId: 'user-1',
    role,
    ...overrides,
  };
}

function createMembershipService({ role = 'owner', row = undefined, error = null } = {}) {
  return {
    calls: [],
    async get(input) {
      this.calls.push(input);
      if (error) throw error;
      if (row !== undefined) return row;
      return membership(role);
    },
  };
}

function projectInput(permission, role = 'owner', overrides = {}) {
  return {
    permission,
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ role }),
    ...overrides,
  };
}

async function evaluateProject(permission, role, overrides = {}) {
  return authorizeProjectPolicy(projectInput(permission, role, overrides));
}

async function evaluateResource(permission, role, type, overrides = {}) {
  return authorizeResourceInheritance({
    permission,
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    resource: resource(type),
    projectMembershipService: createMembershipService({ role }),
    ...overrides,
  });
}

test('Project role helpers expose the canonical role matrix', () => {
  assert.deepEqual(getProjectPermissionRoles('project.read'), PROJECT_ROLES);
  assert.deepEqual(getProjectPermissionRoles('project.update'), ['owner', 'admin', 'editor']);
  assert.deepEqual(getProjectPermissionRoles('project.archive'), ['owner', 'admin']);
  assert.deepEqual(getProjectPermissionRoles('project.delete'), ['owner']);
  assert.deepEqual(getProjectPermissionRoles('project.members.read'), ['owner', 'admin', 'editor']);
  assert.deepEqual(getProjectPermissionRoles('project.members.add'), ['owner', 'admin']);
  assert.deepEqual(getProjectPermissionRoles('project.members.update'), ['owner', 'admin']);
  assert.deepEqual(getProjectPermissionRoles('project.members.remove'), ['owner', 'admin']);
  assert.deepEqual(getProjectPermissionRoles('settings.read'), PROJECT_ROLES);
  assert.deepEqual(getProjectPermissionRoles('settings.manage'), ['owner', 'admin']);

  assert.equal(projectRoleGrantsPermission('viewer', 'project.read'), true);
  assert.equal(projectRoleGrantsPermission('viewer', 'project.update'), false);
  assert.equal(projectRoleGrantsPermission('editor', 'project.members.add'), false);
  assert.equal(projectRoleGrantsPermission('owner', 'project.transfer'), true);
});

test('Project policy allows and denies owner admin editor viewer deterministically', async () => {
  const cases = [
    ['project.read', { owner: ALLOW, admin: ALLOW, editor: ALLOW, viewer: ALLOW }],
    [
      'project.update',
      { owner: ALLOW, admin: ALLOW, editor: ALLOW, viewer: INSUFFICIENT_PROJECT_ROLE },
    ],
    [
      'project.archive',
      {
        owner: ALLOW,
        admin: ALLOW,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    [
      'project.delete',
      {
        owner: ALLOW,
        admin: INSUFFICIENT_PROJECT_ROLE,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    [
      'project.members.read',
      { owner: ALLOW, admin: ALLOW, editor: ALLOW, viewer: INSUFFICIENT_PROJECT_ROLE },
    ],
    [
      'project.members.add',
      {
        owner: ALLOW,
        admin: ALLOW,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    [
      'project.members.update',
      {
        owner: ALLOW,
        admin: ALLOW,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    [
      'project.members.remove',
      {
        owner: ALLOW,
        admin: ALLOW,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    [
      'project.transfer',
      {
        owner: ALLOW,
        admin: INSUFFICIENT_PROJECT_ROLE,
        editor: INSUFFICIENT_PROJECT_ROLE,
        viewer: INSUFFICIENT_PROJECT_ROLE,
      },
    ],
    ['settings.read', { owner: ALLOW, admin: ALLOW, editor: ALLOW, viewer: ALLOW }],
  ];

  for (const [permission, expectations] of cases) {
    for (const role of PROJECT_ROLES) {
      const decision = await evaluateProject(permission, role);
      assert.equal(decision.reason, expectations[role], `${permission} ${role}`);
      assert.equal(decision.allowed, expectations[role] === ALLOW, `${permission} ${role}`);
      assert.equal(decision.matchedPolicy, 'project', `${permission} ${role}`);
    }
  }
});

test('Workspace membership without explicit Project membership cannot grant project access', async () => {
  const service = createMembershipService({ row: null });
  const decision = await authorizeProjectPolicy({
    permission: 'project.update',
    principal: HUMAN,
    workspace: workspace({ role: 'owner', isMember: true }),
    project: project(),
    projectMembershipService: service,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NOT_PROJECT_MEMBER);
  assert.equal(decision.status, 403);
  assert.equal(decision.failureKind, 'forbidden');
  assert.deepEqual(service.calls, [
    { projectId: 'project-1', organizationId: 'org-1', userId: 'user-1' },
  ]);
});

test('Project policy ignores caller-supplied membership shortcuts', async () => {
  const forgedMembership = await authorizeProjectPolicy({
    permission: 'project.delete',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembership: membership('owner', { userId: 'victim-user' }),
    projectMembershipService: createMembershipService({ row: null }),
  });
  assert.equal(forgedMembership.reason, NOT_PROJECT_MEMBER);
  assert.equal(forgedMembership.allowed, false);

  const forgedProjectFlags = await authorizeProjectPolicy({
    permission: 'project.delete',
    principal: HUMAN,
    workspace: workspace(),
    project: project({ isMember: true, role: 'owner' }),
    projectMembershipService: createMembershipService({ row: null }),
  });
  assert.equal(forgedProjectFlags.reason, NOT_PROJECT_MEMBER);
  assert.equal(forgedProjectFlags.allowed, false);
});

test('Project policy distinguishes safe not-found and forbidden outcomes', async () => {
  const missingProject = new Error('missing');
  missingProject.code = PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND;
  const unresolvedProject = new Error('unresolved');
  unresolvedProject.code = PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED;
  const workspaceMismatch = new Error('workspace mismatch');
  workspaceMismatch.code = PROJECT_MEMBERSHIP_ERROR_CODES.WORKSPACE_MISMATCH;
  const genericServiceFailure = new Error('service failed');

  const notFound = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project({ projectId: 'missing-project' }),
    projectMembershipService: createMembershipService({ error: missingProject }),
  });
  assert.equal(notFound.reason, NO_PROJECT);
  assert.equal(notFound.status, 404);
  assert.equal(notFound.failureKind, 'not-found');

  const unresolved = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ error: unresolvedProject }),
  });
  assert.equal(unresolved.reason, NO_PROJECT);
  assert.equal(unresolved.status, 404);
  assert.equal(unresolved.failureKind, 'not-found');

  const mismatch = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ error: workspaceMismatch }),
  });
  assert.equal(mismatch.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(mismatch.status, 404);
  assert.equal(mismatch.failureKind, 'not-found');

  const explicitForbidden = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ error: genericServiceFailure }),
  });
  assert.equal(explicitForbidden.reason, EXPLICIT_DENY);
  assert.equal(explicitForbidden.status, 403);
  assert.equal(explicitForbidden.failureKind, 'forbidden');

  const forbidden = await evaluateProject('project.update', 'viewer');
  assert.equal(forbidden.reason, INSUFFICIENT_PROJECT_ROLE);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.failureKind, 'forbidden');
});

test('Project policy rejects provider credentials and raw legacy compatibility', async () => {
  const providerDecision = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: PROVIDER_CREDENTIAL,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(providerDecision.reason, UNSUPPORTED_PRINCIPAL);

  const legacyDecision = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: LEGACY,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(legacyDecision.reason, LEGACY_OWNERSHIP_UNRESOLVED);
  assert.equal(legacyDecision.matchedPolicy, 'legacy-compatibility');
});

test('Project policy decisions do not echo sensitive payloads or membership metadata', async () => {
  const decision = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    projectMembershipService: createMembershipService({ role: 'owner' }),
    rawApiKey: 'muapi-secret',
    providerCredential: { token: 'provider-secret' },
    memberList: [{ userId: 'other-user' }],
    stack: 'internal stack',
  });
  const serialized = JSON.stringify(decision);
  for (const forbidden of [
    'rawApiKey',
    'muapi-secret',
    'providerCredential',
    'provider-secret',
    'memberList',
    'other-user',
    'internal stack',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test('Resource inheritance covers representative Project child domains', async () => {
  assert.deepEqual(PROJECT_INHERITED_RESOURCE_TYPES, [
    'asset',
    'generation',
    'job',
    'project_character',
    'project_product',
    'project_brand',
    'campaign',
    'composition',
    'design',
  ]);

  const cases = [
    ['asset.read', 'asset', 'viewer', ALLOW],
    ['asset.update', 'asset', 'viewer', INSUFFICIENT_PROJECT_ROLE],
    ['asset.delete', 'asset', 'editor', INSUFFICIENT_PROJECT_ROLE],
    ['generation.create', 'generation', 'editor', ALLOW],
    ['generation.cancel', 'generation', 'viewer', INSUFFICIENT_PROJECT_ROLE],
    ['job.retry', 'job', 'editor', ALLOW],
    ['character.update', 'project_character', 'editor', ALLOW],
    ['product.update', 'project_product', 'editor', ALLOW],
    ['brand.update', 'project_brand', 'editor', ALLOW],
    ['campaign.delete', 'campaign', 'editor', INSUFFICIENT_PROJECT_ROLE],
    ['composition.read', 'composition', 'viewer', ALLOW],
    ['design.publish', 'design', 'editor', ALLOW],
    ['design.delete', 'design', 'editor', INSUFFICIENT_PROJECT_ROLE],
  ];

  for (const [permission, type, role, expected] of cases) {
    const decision = await evaluateResource(permission, role, type);
    assert.equal(decision.reason, expected, `${permission} ${type} ${role}`);
    assert.equal(decision.allowed, expected === ALLOW, `${permission} ${type} ${role}`);
    assert.equal(decision.resourceType, type, `${permission} ${type} ${role}`);
  }
});

test('Resource inheritance covers aliases and generation/job lifecycle permutations', async () => {
  const aliases = [
    ['character.read', 'project_character'],
    ['character.update', 'character_use'],
    ['product.read', 'project_product'],
    ['product.update', 'product_use'],
    ['brand.read', 'project_brand'],
    ['brand.update', 'brand_use'],
    ['design.update', 'design_surface'],
    ['design.publish', 'design_resource'],
  ];

  for (const [permission, type] of aliases) {
    const decision = await evaluateResource(permission, 'editor', type, {
      resource: resource(type),
    });
    assert.equal(decision.reason, ALLOW, `${permission} ${type}`);
    assert.equal(decision.resourceType, type, `${permission} ${type}`);
  }

  for (const domain of ['generation', 'job']) {
    for (const action of ['create', 'cancel', 'retry']) {
      const decision = await evaluateResource(`${domain}.${action}`, 'editor', domain);
      assert.equal(decision.reason, ALLOW, `${domain}.${action}`);
      assert.equal(decision.allowed, true, `${domain}.${action}`);
    }
  }
});

test('Resource inheritance does not transfer reusable root ownership', async () => {
  for (const [permission, type, reason, status] of [
    ['character.update', 'character', EXPLICIT_DENY, 403],
    ['product.update', 'product', EXPLICIT_DENY, 403],
    ['brand.update', 'brand', EXPLICIT_DENY, 403],
    ['design.read', 'design_template', RESOURCE_SCOPE_MISMATCH, 404],
    ['design.read', 'design_component', RESOURCE_SCOPE_MISMATCH, 404],
    ['design.read', 'design_system', RESOURCE_SCOPE_MISMATCH, 404],
    ['design.read', 'design_component_set', RESOURCE_SCOPE_MISMATCH, 404],
  ]) {
    const decision = await evaluateResource(permission, 'owner', type, {
      resource: resource(type),
    });
    assert.equal(decision.reason, reason, `${permission} ${type}`);
    assert.equal(decision.status, status, `${permission} ${type}`);
  }
});

test('Resource inheritance denies scope mismatches before role grants', async () => {
  const wrongProject = await evaluateResource('asset.read', 'owner', 'asset', {
    resource: resource('asset', { projectId: 'project-2' }),
  });
  assert.equal(wrongProject.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(wrongProject.status, 404);
  assert.equal(wrongProject.failureKind, 'not-found');

  const wrongWorkspace = await evaluateResource('campaign.read', 'owner', 'campaign', {
    resource: resource('campaign', { organizationId: 'org-2' }),
  });
  assert.equal(wrongWorkspace.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(wrongWorkspace.status, 404);
  assert.equal(wrongWorkspace.failureKind, 'not-found');

  const wrongProjectAndInsufficientRole = await evaluateResource('asset.update', 'viewer', 'asset', {
    resource: resource('asset', { projectId: 'project-2' }),
  });
  assert.equal(wrongProjectAndInsufficientRole.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(wrongProjectAndInsufficientRole.status, 404);
  assert.equal(wrongProjectAndInsufficientRole.failureKind, 'not-found');
});

test('Resource inheritance distinguishes missing resources from forbidden membership', async () => {
  const missing = await authorizeResourceInheritance({
    permission: 'asset.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    resource: null,
    resourceType: 'asset',
    resourceId: 'asset-missing',
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(missing.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(missing.status, 404);
  assert.equal(missing.failureKind, 'not-found');
  assert.equal(missing.resourceType, 'asset');

  const forbidden = await authorizeResourceInheritance({
    permission: 'asset.read',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    resource: resource('asset'),
    projectMembershipService: createMembershipService({ row: null }),
  });
  assert.equal(forbidden.reason, NOT_PROJECT_MEMBER);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.failureKind, 'forbidden');
});

test('Resource inheritance rejects provider credentials before resource disclosure', async () => {
  const decision = await authorizeResourceInheritance({
    permission: 'asset.read',
    principal: PROVIDER_CREDENTIAL,
    workspace: workspace(),
    project: project(),
    resource: null,
    resourceType: 'asset',
    resourceId: 'asset-missing',
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(decision.reason, UNSUPPORTED_PRINCIPAL);
  assert.equal(decision.status, 403);
  assert.equal(decision.failureKind, 'forbidden');
  assert.equal(decision.resourceType, 'asset');
});

test('Exported resource inheritance resolver is deny-by-default without a principal', async () => {
  const decision = await resolveResourceInheritance({
    permission: 'asset.read',
    workspace: workspace(),
    project: project(),
    resource: resource('asset'),
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(decision.reason, NO_PRINCIPAL);
  assert.equal(decision.allowed, false);
});

test('Resource inheritance supports create requests through the target Project', async () => {
  const decision = await authorizeResourceInheritance({
    permission: 'asset.create',
    principal: HUMAN,
    workspace: workspace(),
    project: project(),
    resource: undefined,
    projectMembershipService: createMembershipService({ role: 'editor' }),
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, ALLOW);
  assert.equal(decision.resourceType, 'asset');
  assert.deepEqual(decision.requiredRoles, ['owner', 'admin', 'editor']);
});

test('Resource inheritance is deny-by-default for unknown and non-project inherited inputs', async () => {
  const unknown = await resolveResourceInheritance({
    permission: 'not.real',
    workspace: workspace(),
    project: project(),
    resource: resource('asset'),
  });
  assert.equal(unknown.reason, UNKNOWN_PERMISSION);
  assert.equal(unknown.allowed, false);

  const workspaceRoot = await resolveResourceInheritance({
    permission: 'design_template.read',
    workspace: workspace(),
    project: project(),
    resource: resource('design_template'),
  });
  assert.equal(workspaceRoot.reason, EXPLICIT_DENY);
  assert.equal(workspaceRoot.status, 403);
});

test('Resource inheritance requires canonical Project context for child resources', async () => {
  const decision = await authorizeResourceInheritance({
    permission: 'asset.read',
    principal: HUMAN,
    workspace: workspace(),
    project: null,
    resource: resource('asset'),
    projectMembershipService: createMembershipService({ role: 'owner' }),
  });
  assert.equal(decision.reason, NO_PROJECT);
  assert.equal(decision.status, 404);
});
