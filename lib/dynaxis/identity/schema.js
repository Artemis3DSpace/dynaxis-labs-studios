/**
 * Dynaxis identity mapping tables.
 *
 * Better Auth owns users, organizations, memberships, invitations, and active
 * organization session fields. Dynaxis records product semantics that sit on
 * top of those auth primitives here in public.
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user, organization } from '../auth/schema.js';

export const dynaxisPersonalWorkspaces = pgTable(
  'dynaxis_personal_workspaces',
  {
    userId: uuid('user_id')
      .primaryKey()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('dynaxis_personal_workspaces_organization_uidx').on(table.organizationId)]
);

export const dynaxisPersonalWorkspacesRelations = relations(
  dynaxisPersonalWorkspaces,
  ({ one }) => ({
    user: one(user, {
      fields: [dynaxisPersonalWorkspaces.userId],
      references: [user.id],
    }),
    organization: one(organization, {
      fields: [dynaxisPersonalWorkspaces.organizationId],
      references: [organization.id],
    }),
  })
);

export const DYNAXIS_IDENTITY_DRIZZLE_SCHEMA = Object.freeze({
  dynaxisPersonalWorkspaces,
  dynaxisPersonalWorkspacesRelations,
});
