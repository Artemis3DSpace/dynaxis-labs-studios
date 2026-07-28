import 'server-only';

const HUMAN_LEGACY = Object.freeze(['human', 'legacy']);
const HUMAN_ONLY = Object.freeze(['human']);
const WORKSPACE_ROLES_ALL = Object.freeze(['owner', 'admin', 'member', 'viewer']);
const WORKSPACE_ROLES_WRITE = Object.freeze(['owner', 'admin', 'member']);
const WORKSPACE_ROLES_ADMIN = Object.freeze(['owner', 'admin']);
const WORKSPACE_ROLES_OWNER = Object.freeze(['owner']);

function definePermission(name, definition) {
  return Object.freeze({
    name,
    domain: name.split('.')[0],
    requiredWorkspace: false,
    workspaceMembershipRequired: false,
    requiredProject: false,
    projectMembershipRequired: false,
    policyLayer: 'explicit-deny',
    scopeMode: 'workspace',
    allowedPrincipalTypes: HUMAN_ONLY,
    workspaceRoles: Object.freeze([]),
    ...definition,
  });
}

const WORKSPACE_PERMISSIONS = [
  ['workspace.read', HUMAN_LEGACY, WORKSPACE_ROLES_ALL],
  ['workspace.update', HUMAN_ONLY, WORKSPACE_ROLES_ADMIN],
  ['workspace.members.read', HUMAN_ONLY, Object.freeze(['owner', 'admin', 'member'])],
  ['workspace.members.invite', HUMAN_ONLY, WORKSPACE_ROLES_ADMIN],
  ['workspace.members.update', HUMAN_ONLY, WORKSPACE_ROLES_ADMIN],
  ['workspace.members.remove', HUMAN_ONLY, WORKSPACE_ROLES_ADMIN],
  ['workspace.billing.read', HUMAN_ONLY, WORKSPACE_ROLES_ADMIN],
  ['workspace.billing.manage', HUMAN_ONLY, WORKSPACE_ROLES_OWNER],
  ['workspace.transfer', HUMAN_ONLY, WORKSPACE_ROLES_OWNER],
].map(([name, allowedPrincipalTypes, workspaceRoles]) =>
  definePermission(name, {
    resource: name === 'workspace.read' ? 'Workspace' : 'Workspace governance',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    policyLayer: 'workspace',
    allowedPrincipalTypes,
    workspaceRoles,
  })
);

const PROJECT_PERMISSIONS = [
  definePermission('project.read', {
    resource: 'Project',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    requiredProject: true,
    projectMembershipRequired: true,
    policyLayer: 'project',
    scopeMode: 'project',
    allowedPrincipalTypes: HUMAN_LEGACY,
  }),
  definePermission('project.create', {
    resource: 'Project create input',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    policyLayer: 'workspace',
    allowedPrincipalTypes: HUMAN_LEGACY,
    workspaceRoles: WORKSPACE_ROLES_ADMIN,
  }),
  ...['project.update', 'project.archive', 'project.delete', 'project.members.read',
    'project.members.add', 'project.members.update', 'project.members.remove',
    'project.transfer'].map((name) =>
    definePermission(name, {
      resource: name.startsWith('project.members') ? 'Project member' : 'Project',
      requiredWorkspace: true,
      workspaceMembershipRequired: true,
      requiredProject: true,
      projectMembershipRequired: true,
      policyLayer: 'project',
      scopeMode: 'project',
      allowedPrincipalTypes: name === 'project.delete' ? HUMAN_ONLY : HUMAN_LEGACY,
    })
  ),
];

const PROJECT_CHILD_DOMAINS = Object.freeze(['asset', 'generation', 'job', 'campaign', 'composition']);
const PROJECT_CHILD_ACTIONS = Object.freeze(['read', 'create', 'update', 'delete', 'cancel', 'retry']);

const PROJECT_CHILD_PERMISSIONS = PROJECT_CHILD_DOMAINS.flatMap((domain) =>
  PROJECT_CHILD_ACTIONS
    .filter((action) => {
      if (domain === 'asset' || domain === 'campaign' || domain === 'composition') {
        return ['read', 'create', 'update', 'delete'].includes(action);
      }
      return ['read', 'create', 'cancel', 'retry'].includes(action);
    })
    .map((action) =>
      definePermission(`${domain}.${action}`, {
        resource: domain,
        requiredWorkspace: true,
        workspaceMembershipRequired: true,
        requiredProject: true,
        projectMembershipRequired: true,
        policyLayer: 'resource-inheritance',
        scopeMode: 'project',
        allowedPrincipalTypes: action === 'delete' ? HUMAN_ONLY : HUMAN_LEGACY,
      })
    )
);

const WORKSPACE_ROOT_DOMAINS = Object.freeze([
  'character',
  'product',
  'brand',
  'design_template',
  'design_component',
  'design_system',
  'design_component_set',
]);

const WORKSPACE_ROOT_PERMISSIONS = WORKSPACE_ROOT_DOMAINS.flatMap((domain) =>
  ['read', 'create', 'update', 'delete'].map((action) =>
    definePermission(`${domain}.${action}`, {
      resource: domain,
      requiredWorkspace: true,
      workspaceMembershipRequired: true,
      policyLayer: 'workspace',
      allowedPrincipalTypes: action === 'delete' ? HUMAN_ONLY : HUMAN_LEGACY,
      workspaceRoles:
        action === 'read'
          ? WORKSPACE_ROLES_ALL
          : action === 'delete'
            ? WORKSPACE_ROLES_ADMIN
            : WORKSPACE_ROLES_WRITE,
    })
  )
);

const DESIGN_PERMISSIONS = ['read', 'create', 'update', 'delete', 'publish'].map((action) =>
  definePermission(`design.${action}`, {
    resource: 'Design surface',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    requiredProject: false,
    projectMembershipRequired: false,
    policyLayer: 'workspace',
    scopeMode: 'workspace-or-project',
    allowedPrincipalTypes: action === 'delete' ? HUMAN_ONLY : HUMAN_LEGACY,
    workspaceRoles:
      action === 'read'
        ? WORKSPACE_ROLES_ALL
        : action === 'delete'
          ? WORKSPACE_ROLES_ADMIN
          : WORKSPACE_ROLES_WRITE,
  })
);

const GOVERNANCE_PERMISSIONS = [
  definePermission('audit.read', {
    resource: 'Workspace audit view',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    policyLayer: 'workspace',
    allowedPrincipalTypes: HUMAN_ONLY,
    workspaceRoles: WORKSPACE_ROLES_ADMIN,
  }),
  definePermission('settings.read', {
    resource: 'Workspace settings',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    policyLayer: 'workspace',
    scopeMode: 'workspace-or-project',
    allowedPrincipalTypes: HUMAN_ONLY,
    workspaceRoles: WORKSPACE_ROLES_ALL,
  }),
  definePermission('settings.manage', {
    resource: 'Workspace settings',
    requiredWorkspace: true,
    workspaceMembershipRequired: true,
    policyLayer: 'workspace',
    scopeMode: 'workspace-or-project',
    allowedPrincipalTypes: HUMAN_ONLY,
    workspaceRoles: WORKSPACE_ROLES_ADMIN,
  }),
];

const DEFINITIONS = Object.freeze([
  ...WORKSPACE_PERMISSIONS,
  ...PROJECT_PERMISSIONS,
  ...PROJECT_CHILD_PERMISSIONS,
  ...DESIGN_PERMISSIONS,
  ...WORKSPACE_ROOT_PERMISSIONS,
  ...GOVERNANCE_PERMISSIONS,
]);

export const DYNAXIS_PERMISSIONS = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((definition) => [definition.name, definition]))
);

export const DYNAXIS_PERMISSION_NAMES = Object.freeze(
  Object.keys(DYNAXIS_PERMISSIONS).sort()
);

export function isDynaxisPermission(permission) {
  return Object.prototype.hasOwnProperty.call(DYNAXIS_PERMISSIONS, permission);
}

export function getPermissionDefinition(permission) {
  return DYNAXIS_PERMISSIONS[permission] || null;
}
