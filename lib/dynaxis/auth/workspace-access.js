/**
 * Static Better Auth organization roles used by the Dynaxis Workspace layer.
 *
 * Dynaxis domain permissions remain separate future policy; this module only
 * configures Better Auth's organization access contract for Phase 7C.2.
 */

import { defaultAc, defaultRoles, defaultStatements } from 'better-auth/plugins/organization/access';

export const DYNAXIS_WORKSPACE_ROLE_NAMES = Object.freeze(['owner', 'admin', 'member', 'viewer']);
export const DYNAXIS_LEGACY_OWNER_CLAIM_ROLES = Object.freeze(['owner', 'admin']);

const WORKSPACE_ROLE_PRIORITY = Object.freeze(['owner', 'admin', 'member', 'viewer']);

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

export function parseWorkspaceRole(role) {
  const roles = parseWorkspaceRoles(role);
  return WORKSPACE_ROLE_PRIORITY.find((allowedRole) => roles.includes(allowedRole)) || null;
}

export function canClaimLegacyOwnerRef(role) {
  const roles = new Set(parseWorkspaceRoles(role));
  return DYNAXIS_LEGACY_OWNER_CLAIM_ROLES.some((allowedRole) => roles.has(allowedRole));
}

function normalizeId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function resolveActiveOrganizationId(input = {}) {
  return (
    normalizeId(input.activeOrganizationId) ||
    normalizeId(input.session?.activeOrganizationId) ||
    normalizeId(input.session?.activeOrganization?.id) ||
    normalizeId(input.organization?.id) ||
    normalizeId(input.activeOrganization?.id)
  );
}

function resolveMembership(input = {}) {
  return input.member || input.membership || input.workspaceMember || null;
}

export function normalizeWorkspaceAccess(input = {}) {
  const organizationId = resolveActiveOrganizationId(input);
  if (!organizationId) {
    return null;
  }

  const membership = resolveMembership(input);
  const membershipOrganizationId = normalizeId(membership?.organizationId);
  const membershipMatchesActiveWorkspace = membershipOrganizationId === organizationId;
  const role = membershipMatchesActiveWorkspace ? parseWorkspaceRole(membership?.role) : null;

  return {
    organizationId,
    role: role || undefined,
    isMember: Boolean(membershipMatchesActiveWorkspace && role),
    isPersonal: Boolean(input.isPersonal || input.personalWorkspace),
  };
}

export const createWorkspaceAccessFromBetterAuthSession = normalizeWorkspaceAccess;
