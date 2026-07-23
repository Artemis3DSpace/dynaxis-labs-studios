/**
 * Static Better Auth organization roles used by the Dynaxis Workspace layer.
 *
 * Dynaxis domain permissions remain separate future policy; this module only
 * configures Better Auth's organization access contract for Phase 7C.2.
 */

import { defaultAc, defaultRoles, defaultStatements } from 'better-auth/plugins/organization/access';

export const DYNAXIS_WORKSPACE_ROLE_NAMES = Object.freeze(['owner', 'admin', 'member', 'viewer']);
export const DYNAXIS_LEGACY_OWNER_CLAIM_ROLES = Object.freeze(['owner', 'admin']);

export const viewerAc = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ['read'],
});

export const dynaxisWorkspaceAccessControl = defaultAc;

export const dynaxisWorkspaceRoles = Object.freeze({
  ...defaultRoles,
  viewer: viewerAc,
});

export const DYNAXIS_WORKSPACE_ACCESS_SUMMARY = Object.freeze({
  importPath: 'better-auth/plugins/organization/access',
  defaultStatements,
  roles: DYNAXIS_WORKSPACE_ROLE_NAMES,
  dynamicAccessControl: false,
  organizationRoleTable: false,
});

export function parseWorkspaceRoles(role) {
  return String(role || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function canClaimLegacyOwnerRef(role) {
  const roles = new Set(parseWorkspaceRoles(role));
  return DYNAXIS_LEGACY_OWNER_CLAIM_ROLES.some((allowedRole) => roles.has(allowedRole));
}
