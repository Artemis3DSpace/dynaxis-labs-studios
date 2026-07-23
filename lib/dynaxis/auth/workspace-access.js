/**
 * Static Better Auth organization roles used by the Dynaxis Workspace layer.
 *
 * Dynaxis domain permissions remain separate future policy; this module only
 * configures Better Auth's organization access contract for Phase 7C.2.
 */

import { defaultAc, defaultRoles, defaultStatements } from 'better-auth/plugins/organization/access';

export const DYNAXIS_WORKSPACE_ROLE_NAMES = Object.freeze(['owner', 'admin', 'member', 'viewer']);

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
