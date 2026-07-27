import 'server-only';
import { getPermissionDefinition } from './permissions.js';

export const DYNAXIS_WORKSPACE_POLICY_NAME = 'workspace';

const ROLE_RANK = Object.freeze({
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
});

export function isWorkspacePolicyPermission(permission) {
  return getPermissionDefinition(permission)?.policyLayer === DYNAXIS_WORKSPACE_POLICY_NAME;
}

export function workspaceRoleGrantsPermission(role, permission) {
  const definition = getPermissionDefinition(permission);
  const normalizedRole = String(role || '').trim();
  if (!definition || definition.policyLayer !== DYNAXIS_WORKSPACE_POLICY_NAME) {
    return false;
  }
  return definition.workspaceRoles.includes(normalizedRole);
}

export function compareWorkspaceRoles(left, right) {
  return (ROLE_RANK[left] || 0) - (ROLE_RANK[right] || 0);
}

export function evaluateWorkspacePolicy({ permission, workspace }) {
  const definition = getPermissionDefinition(permission);
  const role = String(workspace?.role || '').trim();
  const allowed = workspaceRoleGrantsPermission(role, permission);
  return {
    allowed,
    matchedPolicy: DYNAXIS_WORKSPACE_POLICY_NAME,
    permission,
    workspaceId: workspace?.organizationId,
    requiredRoles: definition?.workspaceRoles || Object.freeze([]),
    role: role || null,
  };
}
