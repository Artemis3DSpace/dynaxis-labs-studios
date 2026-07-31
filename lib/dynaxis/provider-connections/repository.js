/**
 * ProviderConnection persistence repository (WP-7D-04).
 *
 * Thin Drizzle boundary over the WP-7D-03 tables. Adds no schema and no
 * migration: it reads and writes the integrated `0015` shape only.
 *
 * The service layer injects a repository, so tests can substitute an
 * in-memory double without a database.
 */

import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { dynaxisProviderConnections } from './schema.js';
import { dynaxisProviderSecretEnvelopes } from '../secrets/schema.js';

export function createDrizzleProviderConnectionRepository(db = getDb()) {
  return {
    transaction(callback) {
      return db.transaction((tx) => callback(createDrizzleProviderConnectionRepository(tx)));
    },

    async insertConnection(values) {
      const rows = await db.insert(dynaxisProviderConnections).values(values).returning();
      return rows[0] || null;
    },

    async updateConnection(connectionId, patch) {
      const rows = await db
        .update(dynaxisProviderConnections)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(dynaxisProviderConnections.id, connectionId))
        .returning();
      return rows[0] || null;
    },

    async findConnectionById(connectionId) {
      const rows = await db
        .select()
        .from(dynaxisProviderConnections)
        .where(eq(dynaxisProviderConnections.id, connectionId))
        .limit(1);
      return rows[0] || null;
    },

    async listConnectionsForWorkspace(organizationId) {
      return db
        .select()
        .from(dynaxisProviderConnections)
        .where(
          and(
            eq(dynaxisProviderConnections.ownerWorkspaceId, organizationId),
            isNull(dynaxisProviderConnections.deletedAt)
          )
        );
    },

    async listConnectionsForUser(userId) {
      return db
        .select()
        .from(dynaxisProviderConnections)
        .where(
          and(
            eq(dynaxisProviderConnections.ownerUserId, userId),
            isNull(dynaxisProviderConnections.deletedAt)
          )
        );
    },

    async insertEnvelope(values) {
      const rows = await db.insert(dynaxisProviderSecretEnvelopes).values(values).returning();
      return rows[0] || null;
    },

    async findEnvelopeById(envelopeId) {
      const rows = await db
        .select()
        .from(dynaxisProviderSecretEnvelopes)
        .where(eq(dynaxisProviderSecretEnvelopes.id, envelopeId))
        .limit(1);
      return rows[0] || null;
    },

    async findLatestEnvelope(connectionId) {
      const rows = await db
        .select()
        .from(dynaxisProviderSecretEnvelopes)
        .where(eq(dynaxisProviderSecretEnvelopes.connectionId, connectionId))
        .orderBy(desc(dynaxisProviderSecretEnvelopes.secretVersion))
        .limit(1);
      return rows[0] || null;
    },

    async updateEnvelope(envelopeId, patch) {
      const rows = await db
        .update(dynaxisProviderSecretEnvelopes)
        .set(patch)
        .where(eq(dynaxisProviderSecretEnvelopes.id, envelopeId))
        .returning();
      return rows[0] || null;
    },
  };
}
