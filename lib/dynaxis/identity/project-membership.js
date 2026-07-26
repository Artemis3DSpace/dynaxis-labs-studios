/**
 * Canonical Dynaxis Project membership service.
 *
 * Better Auth remains the Workspace membership primitive. Dynaxis owns explicit
 * Project membership state in public.dynaxis_project_members.
 */

import 'server-only';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { member } from '../auth/schema.js';
import { getDb } from '../db/client.js';
import {
  dynaxisProjectMembers,
  dynaxisProjects,
  parseProjectRole,
} from '../db/schema.js';
import { dynaxisOwnerRefClaims, dynaxisPersonalWorkspaces } from './schema.js';
import { resolveCanonicalResourceOrganization } from './workspace-ownership.js';

export const PROJECT_MEMBERSHIP_ERROR_CODES = Object.freeze({
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_WORKSPACE_UNRESOLVED: 'PROJECT_WORKSPACE_UNRESOLVED',
  WORKSPACE_MISMATCH: 'WORKSPACE_MISMATCH',
  USER_NOT_WORKSPACE_MEMBER: 'USER_NOT_WORKSPACE_MEMBER',
  INVALID_PROJECT_ROLE: 'INVALID_PROJECT_ROLE',
  PROJECT_MEMBERSHIP_NOT_FOUND: 'PROJECT_MEMBERSHIP_NOT_FOUND',
  PROJECT_MEMBERSHIP_ALREADY_EXISTS: 'PROJECT_MEMBERSHIP_ALREADY_EXISTS',
  LAST_PROJECT_OWNER: 'LAST_PROJECT_OWNER',
});

const OWNER_ROLE = 'owner';

export class ProjectMembershipServiceError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ProjectMembershipServiceError';
    this.code =
      opts.code || PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND;
    this.status = opts.status || 400;
  }
}

function membershipError(code, status, message) {
  return new ProjectMembershipServiceError(message, { code, status });
}

function requireString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND,
      400,
      `${label} is required`
    );
  }
  return normalized;
}

function normalizeRole(role) {
  const normalized = parseProjectRole(role);
  if (!normalized) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.INVALID_PROJECT_ROLE,
      400,
      'Invalid Project role'
    );
  }
  return normalized;
}

function normalizeOptionalWorkspaceId(input = {}) {
  const supplied = input.organizationId ?? input.workspaceId ?? null;
  const normalized = String(supplied || '').trim();
  return normalized || null;
}

function isProjectMemberDuplicateError(err) {
  const message = String(err?.message || '');
  return (
    err?.code === '23505' &&
    (String(err?.constraint || '') === 'dynaxis_project_members_project_user_uidx' ||
      message.includes('dynaxis_project_members_project_user_uidx'))
  );
}

export function createDrizzleProjectMembershipRepository(db = getDb()) {
  return {
    transaction(callback) {
      return db.transaction((tx) => callback(createDrizzleProjectMembershipRepository(tx)));
    },
    async lockProjectMemberships(projectId) {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${'dynaxis_project_members:' + projectId}, 0))`
      );
    },
    async findProject(projectId) {
      const rows = await db
        .select()
        .from(dynaxisProjects)
        .where(eq(dynaxisProjects.id, projectId))
        .limit(1);
      return rows[0] || null;
    },
    async findClaim(legacyOwnerRef) {
      const rows = await db
        .select()
        .from(dynaxisOwnerRefClaims)
        .where(eq(dynaxisOwnerRefClaims.legacyOwnerRef, legacyOwnerRef))
        .limit(1);
      return rows[0] || null;
    },
    async findWorkspaceMembership({ organizationId, userId }) {
      const rows = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
        .limit(1);
      return rows[0] || null;
    },
    async findPersonalWorkspaceByOrganizationId(organizationId) {
      const rows = await db
        .select()
        .from(dynaxisPersonalWorkspaces)
        .where(eq(dynaxisPersonalWorkspaces.organizationId, organizationId))
        .limit(1);
      return rows[0] || null;
    },
    async findMembership({ projectId, userId }) {
      const rows = await db
        .select()
        .from(dynaxisProjectMembers)
        .where(
          and(eq(dynaxisProjectMembers.projectId, projectId), eq(dynaxisProjectMembers.userId, userId))
        )
        .limit(1);
      return rows[0] || null;
    },
    async insertMembership(membership) {
      const rows = await db.insert(dynaxisProjectMembers).values(membership).returning();
      return rows[0] || null;
    },
    async updateMembership({ projectId, userId, role, updatedAt }) {
      const rows = await db
        .update(dynaxisProjectMembers)
        .set({ role, updatedAt })
        .where(
          and(eq(dynaxisProjectMembers.projectId, projectId), eq(dynaxisProjectMembers.userId, userId))
        )
        .returning();
      return rows[0] || null;
    },
    async deleteMembership({ projectId, userId }) {
      const rows = await db
        .delete(dynaxisProjectMembers)
        .where(
          and(eq(dynaxisProjectMembers.projectId, projectId), eq(dynaxisProjectMembers.userId, userId))
        )
        .returning();
      return rows[0] || null;
    },
    async countOtherProjectOwners({ projectId, userId }) {
      const rows = await db
        .select({ id: dynaxisProjectMembers.id })
        .from(dynaxisProjectMembers)
        .where(
          and(
            eq(dynaxisProjectMembers.projectId, projectId),
            eq(dynaxisProjectMembers.role, OWNER_ROLE),
            ne(dynaxisProjectMembers.userId, userId)
          )
        )
        .limit(1);
      return rows.length;
    },
    async listProjectMemberships(projectId) {
      return db
        .select()
        .from(dynaxisProjectMembers)
        .where(eq(dynaxisProjectMembers.projectId, projectId))
        .orderBy(asc(dynaxisProjectMembers.createdAt), asc(dynaxisProjectMembers.id));
    },
  };
}

async function resolveProjectWorkspace(repository, { projectId, suppliedWorkspaceId = null }) {
  const project = await repository.findProject(projectId);
  if (!project) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND,
      404,
      'Project was not found'
    );
  }

  const organizationId = await resolveCanonicalResourceOrganization(
    {
      organizationId: project.organizationId,
      ownerRef: project.ownerRef,
    },
    { repository }
  );

  if (!organizationId) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED,
      409,
      'Project Workspace ownership is unresolved'
    );
  }
  if (suppliedWorkspaceId && suppliedWorkspaceId !== organizationId) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.WORKSPACE_MISMATCH,
      409,
      'Supplied Workspace does not match Project Workspace'
    );
  }

  return { project, organizationId };
}

async function verifyWorkspaceUser(repository, { organizationId, userId }) {
  const personalWorkspace = await repository.findPersonalWorkspaceByOrganizationId(organizationId);
  if (personalWorkspace && personalWorkspace.userId !== userId) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.USER_NOT_WORKSPACE_MEMBER,
      403,
      'Personal Workspace Projects can only represent the personal owner'
    );
  }

  const workspaceMembership = await repository.findWorkspaceMembership({ organizationId, userId });
  if (!workspaceMembership) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.USER_NOT_WORKSPACE_MEMBER,
      403,
      'User is not a member of the Project Workspace'
    );
  }
  return workspaceMembership;
}

async function assertCanRemoveOwner(repository, membership) {
  if (membership.role !== OWNER_ROLE) {
    return;
  }
  const otherOwnerCount = await repository.countOtherProjectOwners({
    projectId: membership.projectId,
    userId: membership.userId,
  });
  if (otherOwnerCount < 1) {
    throw membershipError(
      PROJECT_MEMBERSHIP_ERROR_CODES.LAST_PROJECT_OWNER,
      409,
      'Project must retain at least one owner'
    );
  }
}

export class ProjectMembershipService {
  constructor({ repository = null } = {}) {
    this.repository = repository;
  }

  getRepository() {
    return this.repository || createDrizzleProjectMembershipRepository();
  }

  async create(input) {
    const projectId = requireString(input?.projectId, 'projectId');
    const userId = requireString(input?.userId, 'userId');
    const role = normalizeRole(input?.role);
    const suppliedWorkspaceId = normalizeOptionalWorkspaceId(input);

    const repository = this.getRepository();
    return repository.transaction(async (tx) => {
      await tx.lockProjectMemberships(projectId);
      const { organizationId } = await resolveProjectWorkspace(tx, { projectId, suppliedWorkspaceId });
      await verifyWorkspaceUser(tx, { organizationId, userId });

      const existing = await tx.findMembership({ projectId, userId });
      if (existing) {
        throw membershipError(
          PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_ALREADY_EXISTS,
          409,
          'Project membership already exists'
        );
      }

      try {
        return await tx.insertMembership({
          projectId,
          organizationId,
          userId,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        if (isProjectMemberDuplicateError(err)) {
          throw membershipError(
            PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_ALREADY_EXISTS,
            409,
            'Project membership already exists'
          );
        }
        throw err;
      }
    });
  }

  async update(input) {
    const projectId = requireString(input?.projectId, 'projectId');
    const userId = requireString(input?.userId, 'userId');
    const role = normalizeRole(input?.role);
    const suppliedWorkspaceId = normalizeOptionalWorkspaceId(input);

    const repository = this.getRepository();
    return repository.transaction(async (tx) => {
      await tx.lockProjectMemberships(projectId);
      const { organizationId } = await resolveProjectWorkspace(tx, { projectId, suppliedWorkspaceId });

      const existing = await tx.findMembership({ projectId, userId });
      if (!existing) {
        throw membershipError(
          PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND,
          404,
          'Project membership was not found'
        );
      }
      await verifyWorkspaceUser(tx, { organizationId, userId });
      if (existing.role === OWNER_ROLE && role !== OWNER_ROLE) {
        await assertCanRemoveOwner(tx, existing);
      }
      return tx.updateMembership({ projectId, userId, role, updatedAt: new Date() });
    });
  }

  async remove(input) {
    const projectId = requireString(input?.projectId, 'projectId');
    const userId = requireString(input?.userId, 'userId');
    const suppliedWorkspaceId = normalizeOptionalWorkspaceId(input);

    const repository = this.getRepository();
    return repository.transaction(async (tx) => {
      await tx.lockProjectMemberships(projectId);
      const { organizationId } = await resolveProjectWorkspace(tx, { projectId, suppliedWorkspaceId });

      const existing = await tx.findMembership({ projectId, userId });
      if (!existing) {
        throw membershipError(
          PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND,
          404,
          'Project membership was not found'
        );
      }
      await verifyWorkspaceUser(tx, { organizationId, userId });
      await assertCanRemoveOwner(tx, existing);
      return tx.deleteMembership({ projectId, userId });
    });
  }

  async get(input) {
    const projectId = requireString(input?.projectId, 'projectId');
    const userId = requireString(input?.userId, 'userId');
    const suppliedWorkspaceId = normalizeOptionalWorkspaceId(input);
    const repository = this.getRepository();
    const { organizationId } = await resolveProjectWorkspace(repository, {
      projectId,
      suppliedWorkspaceId,
    });
    const membership = await repository.findMembership({ projectId, userId });
    return membership && membership.organizationId === organizationId ? membership : null;
  }

  async list(input) {
    const projectId = requireString(input?.projectId, 'projectId');
    const suppliedWorkspaceId = normalizeOptionalWorkspaceId(input);
    const repository = this.getRepository();
    await resolveProjectWorkspace(repository, { projectId, suppliedWorkspaceId });
    return repository.listProjectMemberships(projectId);
  }
}

export function createProjectMembershipService(opts = {}) {
  return new ProjectMembershipService(opts);
}

export const projectMembershipService = createProjectMembershipService();
