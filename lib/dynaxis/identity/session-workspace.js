/**
 * Better Auth database hooks for active Dynaxis Workspace initialization.
 */

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { member, organization, user as authUser } from '../auth/schema.js';
import { normalizeWorkspaceAccess } from '../auth/workspace-access.js';
import { dynaxisPersonalWorkspaces } from './schema.js';
import { ensurePersonalWorkspaceForUser } from './personal-workspace.js';

async function findUserById(db, userId) {
  const rows = await db.select().from(authUser).where(eq(authUser.id, userId)).limit(1);
  return rows[0] || null;
}

async function isValidActiveOrganizationForUser(db, userId, organizationId) {
  if (!organizationId) {
    return false;
  }
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1);
  return rows.length > 0;
}

function normalizeId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function sessionFromPayload(payload = {}) {
  return payload?.session || payload;
}

export function createDrizzleSessionWorkspaceRepository(db = getDb()) {
  return {
    async findActiveOrganization(organizationId) {
      const rows = await db
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      return rows[0] || null;
    },
    async findMembership({ organizationId, userId }) {
      const rows = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
        .limit(1);
      return rows[0] || null;
    },
    async findPersonalWorkspace(organizationId) {
      const rows = await db
        .select()
        .from(dynaxisPersonalWorkspaces)
        .where(eq(dynaxisPersonalWorkspaces.organizationId, organizationId))
        .limit(1);
      return rows[0] || null;
    },
  };
}

export async function resolveSessionActiveOrganization(session, { db = getDb() } = {}) {
  if (!session?.userId) {
    return session;
  }

  const user = await findUserById(db, session.userId);
  if (!user) {
    return session;
  }

  const personalWorkspace = await ensurePersonalWorkspaceForUser(user, { db });
  if (
    session.activeOrganizationId &&
    (await isValidActiveOrganizationForUser(db, session.userId, session.activeOrganizationId))
  ) {
    return session;
  }

  return {
    ...session,
    activeOrganizationId: personalWorkspace.organizationId,
  };
}

export async function resolveActiveSessionWorkspace(
  sessionPayload,
  { db = null, repository = null } = {}
) {
  const session = sessionFromPayload(sessionPayload);
  const userId = normalizeId(session?.userId || sessionPayload?.user?.id);
  const activeOrganizationId = normalizeId(
    session?.activeOrganizationId || session?.activeOrganization?.id
  );
  if (!userId || !activeOrganizationId) {
    return null;
  }

  const repo = repository || createDrizzleSessionWorkspaceRepository(db || getDb());
  const [activeOrganization, membership, personalWorkspace] = await Promise.all([
    repo.findActiveOrganization(activeOrganizationId),
    repo.findMembership({ organizationId: activeOrganizationId, userId }),
    repo.findPersonalWorkspace(activeOrganizationId),
  ]);
  const workspace = normalizeWorkspaceAccess({
    session: { activeOrganizationId },
    member: membership,
    personalWorkspace,
  });

  if (!workspace) {
    return null;
  }

  return {
    ...workspace,
    ...(activeOrganization?.name ? { name: activeOrganization.name } : {}),
    ...(activeOrganization?.slug ? { slug: activeOrganization.slug } : {}),
  };
}

export function createDynaxisWorkspaceDatabaseHooks({ db = getDb() } = {}) {
  return {
    session: {
      create: {
        async before(session) {
          return {
            data: await resolveSessionActiveOrganization(session, { db }),
          };
        },
      },
    },
  };
}
