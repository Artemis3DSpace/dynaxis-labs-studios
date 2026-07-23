/**
 * Server-side protections for personal workspaces.
 */

import 'server-only';
import { APIError } from 'better-auth/api';
import { getDb } from '../db/client.js';
import { isPersonalWorkspaceOrganization } from './personal-workspace.js';

export const DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE =
  'DYNAXIS_PERSONAL_WORKSPACE_PROTECTED';

export function throwPersonalWorkspaceProtected(action) {
  throw new APIError('FORBIDDEN', {
    code: DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE,
    message: `Personal workspace ${action} is not allowed`,
  });
}

export async function assertPersonalWorkspaceMutationAllowed(
  { organizationId, action, member, newRole },
  { db = getDb() } = {}
) {
  const isPersonal = await isPersonalWorkspaceOrganization(organizationId, { db });
  if (!isPersonal) {
    return true;
  }

  if (action === 'deleteOrganization') {
    throwPersonalWorkspaceProtected('deletion');
  }
  if (action === 'inviteMember') {
    throwPersonalWorkspaceProtected('invitations');
  }
  if (action === 'addMember') {
    throwPersonalWorkspaceProtected('member additions');
  }
  if (action === 'removeMember') {
    throwPersonalWorkspaceProtected('owner removal');
  }
  if (action === 'updateMemberRole') {
    const isOwner = String(member?.role || '')
      .split(',')
      .map((role) => role.trim())
      .includes('owner');
    const keepsOwner = String(newRole || '')
      .split(',')
      .map((role) => role.trim())
      .includes('owner');
    if (isOwner && !keepsOwner) {
      throwPersonalWorkspaceProtected('owner demotion');
    }
  }

  return true;
}

export function createDynaxisWorkspaceOrganizationHooks({ db = getDb() } = {}) {
  return {
    async beforeDeleteOrganization({ organization }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: organization.id, action: 'deleteOrganization' },
        { db }
      );
    },
    async beforeAddMember({ member }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: member.organizationId, action: 'addMember' },
        { db }
      );
    },
    async beforeRemoveMember({ member }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: member.organizationId, action: 'removeMember', member },
        { db }
      );
    },
    async beforeUpdateMemberRole({ member, newRole }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: member.organizationId, action: 'updateMemberRole', member, newRole },
        { db }
      );
    },
    async beforeCreateInvitation({ invitation }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: invitation.organizationId, action: 'inviteMember' },
        { db }
      );
    },
    async beforeAcceptInvitation({ invitation }) {
      await assertPersonalWorkspaceMutationAllowed(
        { organizationId: invitation.organizationId, action: 'addMember' },
        { db }
      );
    },
  };
}
