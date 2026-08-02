/**
 * Dynaxis PostgreSQL client (Drizzle).
 *
 * Production requires DATABASE_URL. There is no silent localStorage / SQLite fallback.
 * Tests may set DYNAXIS_PLATFORM_DRIVER=memory (explicit only).
 */

import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dynaxisSchema from './schema.js';
import { AUTH_DRIZZLE_SCHEMA } from '../auth/schema.js';
import { DYNAXIS_IDENTITY_DRIZZLE_SCHEMA } from '../identity/schema.js';
import { DYNAXIS_JOB_DRIZZLE_SCHEMA } from '../jobs/schema.js';
import { DYNAXIS_PROVIDER_CONNECTION_DRIZZLE_SCHEMA } from '../provider-connections/schema.js';
import { DYNAXIS_SECRET_ENVELOPE_DRIZZLE_SCHEMA } from '../secrets/schema.js';

export const DRIZZLE_SCHEMA = {
  ...dynaxisSchema,
  ...AUTH_DRIZZLE_SCHEMA,
  ...DYNAXIS_IDENTITY_DRIZZLE_SCHEMA,
  ...DYNAXIS_JOB_DRIZZLE_SCHEMA,
  ...DYNAXIS_PROVIDER_CONNECTION_DRIZZLE_SCHEMA,
  ...DYNAXIS_SECRET_ENVELOPE_DRIZZLE_SCHEMA,
};

export class PlatformPersistenceError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = 'PlatformPersistenceError';
    this.code = opts.code || 'PLATFORM_PERSISTENCE_UNAVAILABLE';
    this.status = opts.status || 503;
  }
}

let sqlClient = null;
let dbInstance = null;

/**
 * @returns {boolean}
 */
export function isPlatformDbConfigured() {
  return Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
}

/**
 * @returns {boolean}
 */
export function isMemoryDriverAllowed() {
  return (
    process.env.DYNAXIS_PLATFORM_DRIVER === 'memory' &&
    (process.env.NODE_ENV === 'test' || process.env.DYNAXIS_ALLOW_MEMORY_STORE === '1')
  );
}

/**
 * @returns {import('drizzle-orm/postgres-js').PostgresJsDatabase<typeof DRIZZLE_SCHEMA>}
 */
export function getDb() {
  if (isMemoryDriverAllowed()) {
    throw new PlatformPersistenceError(
      'Memory driver selected — use getPlatformStore() instead of getDb()',
      { code: 'MEMORY_DRIVER' }
    );
  }
  if (!isPlatformDbConfigured()) {
    throw new PlatformPersistenceError(
      'DATABASE_URL is required for Dynaxis platform persistence (PostgreSQL). ' +
        'Set DATABASE_URL to a postgres:// or postgresql:// connection string. ' +
        'Platform metadata is not stored in browser localStorage.',
      { code: 'DATABASE_URL_MISSING', status: 503 }
    );
  }
  if (!dbInstance) {
    sqlClient = postgres(process.env.DATABASE_URL, {
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      prepare: false,
    });
    dbInstance = drizzle(sqlClient, { schema: DRIZZLE_SCHEMA });
  }
  return dbInstance;
}

/**
 * Close pool (tests / scripts).
 */
export async function closeDb() {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    dbInstance = null;
  }
}

/**
 * Reset cached connection (tests).
 */
export function resetDbCache() {
  sqlClient = null;
  dbInstance = null;
}
