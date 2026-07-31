/**
 * Personal workspace provisioning for Dynaxis users.
 *
 * Better Auth 1.6.23 does not expose an organization API that can participate
 * in the same Drizzle transaction as Dynaxis session creation. This boundary
 * performs a small, isolated direct write to Better Auth organization/member
 * tables so personal workspace creation is atomic with Dynaxis mapping state.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { organization, member, user as authUser } from '../auth/schema.js';
import { dynaxisPersonalWorkspaces } from './schema.js';

export const DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE = 'owner';
export const DYNAXIS_PERSONAL_WORKSPACE_SLUG_PREFIX = 'personal';
export const DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING_CODE =
  'DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING';

export class DynaxisPersonalWorkspaceError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'DynaxisPersonalWorkspaceError';
    this.code = opts.code || 'DYNAXIS_PERSONAL_WORKSPACE_ERROR';
    this.status = opts.status || 500;
  }
}

export function personalWorkspaceSlugForUserId(userId) {
  const stableId = String(userId || '').trim().toLowerCase().replace(/[^a-f0-9-]/g, '');
  if (!stableId) {
    throw new DynaxisPersonalWorkspaceError('User id is required for personal workspace slug', {
      code: 'DYNAXIS_PERSONAL_WORKSPACE_USER_ID_REQUIRED',
      status: 400,
    });
  }
  return `${DYNAXIS_PERSONAL_WORKSPACE_SLUG_PREFIX}-${stableId.replaceAll('-', '')}`;
}

export function personalWorkspaceNameForUser(user) {
  const name = String(user?.name || '').trim();
  return name ? `${name} Personal Workspace` : 'Personal Workspace';
}

async function findPersonalWorkspace(db, userId) {
  const rows = await db
    .select()
    .from(dynaxisPersonalWorkspaces)
    .where(eq(dynaxisPersonalWorkspaces.userId, userId))
    .limit(1);
  return rows[0] || null;
}

async function findOrganizationBySlug(db, slug) {
  const rows = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
  return rows[0] || null;
}

async function findOrganizationById(db, organizationId) {
  const rows = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1);
  return rows[0] || null;
}

async function findMembership(db, userId, organizationId) {
  const rows = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  return rows[0] || null;
}

function membershipHasOwnerRole(membership) {
  return String(membership?.role || '')
    .split(',')
    .map((role) => role.trim())
    .includes(DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE);
}

async function findAuthUser(db, userId) {
  const rows = await db.select().from(authUser).where(eq(authUser.id, userId)).limit(1);
  return rows[0] || null;
}

async function createOrFindPersonalOrganization(tx, user) {
  const slug = personalWorkspaceSlugForUserId(user.id);
  const existing = await findOrganizationBySlug(tx, slug);
  if (existing) {
    return existing;
  }

  const created = await tx
    .insert(organization)
    .values({
      id: randomUUID(),
      name: personalWorkspaceNameForUser(user),
      slug,
      createdAt: new Date(),
      metadata: null,
    })
    .onConflictDoNothing({ target: organization.slug })
    .returning();

  return created[0] || (await findOrganizationBySlug(tx, slug));
}

async function ensureOwnerMembership(tx, userId, organizationId) {
  await tx
    .insert(member)
    .values({
      id: randomUUID(),
      organizationId,
      userId,
      role: DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE,
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [member.organizationId, member.userId],
    });
}

async function restoreOwnerMembership(db, userId, organizationId, membership) {
  if (!membership) {
    return ensureOwnerMembership(db, userId, organizationId);
  }
  if (membershipHasOwnerRole(membership)) {
    return;
  }
  await db
    .update(member)
    .set({ role: DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE })
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)));
}

/**
 * Repairs a previously provisioned personal workspace so partial or drifted
 * state (a membership row lost or downgraded outside the normal mutation
 * path) converges back to the owner-membership invariant. Never invents a
 * replacement organization: a mapping that points at a deleted organization
 * is a corrupted state and fails closed instead of silently rewriting it.
 */
async function recoverPersonalWorkspaceIntegrity(db, mapping) {
  const org = await findOrganizationById(db, mapping.organizationId);
  if (!org) {
    throw new DynaxisPersonalWorkspaceError(
      'Personal workspace organization is missing for an existing mapping',
      {
        code: DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING_CODE,
        status: 500,
      }
    );
  }

  const membership = await findMembership(db, mapping.userId, mapping.organizationId);
  await restoreOwnerMembership(db, mapping.userId, mapping.organizationId, membership);
  return mapping;
}

async function createMappingOrReread(tx, userId, organizationId) {
  const inserted = await tx
    .insert(dynaxisPersonalWorkspaces)
    .values({
      userId,
      organizationId,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: dynaxisPersonalWorkspaces.userId })
    .returning();

  return inserted[0] || (await findPersonalWorkspace(tx, userId));
}

export async function ensurePersonalWorkspaceForUser(user, { db = getDb() } = {}) {
  if (!user?.id) {
    throw new DynaxisPersonalWorkspaceError('User id is required for personal workspace', {
      code: 'DYNAXIS_PERSONAL_WORKSPACE_USER_REQUIRED',
      status: 400,
    });
  }

  const existing = await findPersonalWorkspace(db, user.id);
  if (existing) {
    return recoverPersonalWorkspaceIntegrity(db, existing);
  }

  return db.transaction(async (tx) => {
    const reread = await findPersonalWorkspace(tx, user.id);
    if (reread) {
      return recoverPersonalWorkspaceIntegrity(tx, reread);
    }

    const persistedUser = await findAuthUser(tx, user.id);
    if (!persistedUser) {
      throw new DynaxisPersonalWorkspaceError('Cannot create personal workspace for unknown user', {
        code: 'DYNAXIS_AUTH_USER_NOT_FOUND',
        status: 404,
      });
    }

    const personalOrganization = await createOrFindPersonalOrganization(tx, {
      ...persistedUser,
      ...user,
      id: persistedUser.id,
    });
    if (!personalOrganization?.id) {
      throw new DynaxisPersonalWorkspaceError('Failed to create personal workspace organization');
    }

    await ensureOwnerMembership(tx, persistedUser.id, personalOrganization.id);
    return createMappingOrReread(tx, persistedUser.id, personalOrganization.id);
  });
}

export async function getPersonalWorkspaceForUserId(userId, { db = getDb() } = {}) {
  return findPersonalWorkspace(db, userId);
}

export async function isPersonalWorkspaceOrganization(organizationId, { db = getDb() } = {}) {
  if (!organizationId) {
    return false;
  }
  const rows = await db
    .select({ organizationId: dynaxisPersonalWorkspaces.organizationId })
    .from(dynaxisPersonalWorkspaces)
    .where(eq(dynaxisPersonalWorkspaces.organizationId, organizationId))
    .limit(1);
  return rows.length > 0;
}
