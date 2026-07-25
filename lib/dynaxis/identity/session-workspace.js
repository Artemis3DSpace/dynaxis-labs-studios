/**
 * Better Auth database hooks for active Dynaxis Workspace initialization.
 */

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { member, user as authUser } from '../auth/schema.js';
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
