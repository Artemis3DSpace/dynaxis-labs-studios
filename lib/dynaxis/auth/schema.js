/**
 * Better Auth-owned PostgreSQL schema for Dynaxis authentication.
 *
 * This file intentionally contains only Better Auth core models. Dynaxis
 * creative-domain tables remain in lib/dynaxis/db/schema.js under public.
 */

import { relations } from 'drizzle-orm';
import { pgSchema, uuid, text, bigint, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';

export const AUTH_SCHEMA_NAME = 'auth';
export const authPgSchema = pgSchema(AUTH_SCHEMA_NAME);

export const user = authPgSchema.table('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = authPgSchema.table(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = authPgSchema.table(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = authPgSchema.table(
  'verification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const rateLimit = authPgSchema.table('rate_limit', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const BETTER_AUTH_CORE_MODELS = Object.freeze([
  'user',
  'session',
  'account',
  'verification',
  'rateLimit',
]);

export const BETTER_AUTH_SCHEMA_NOTES = Object.freeze({
  generatedReference: '/tmp/dynaxis-better-auth-1.6.23-schema.ts',
  deliberateDifference:
    'Better Auth 1.6.23 CLI emits text id columns; Dynaxis uses UUID columns with advanced.database.generateId="uuid" so future Dynaxis foreign keys can reference auth.user.id.',
});

export const BETTER_AUTH_DRIZZLE_SCHEMA = Object.freeze({
  user,
  session,
  account,
  verification,
  rateLimit,
});

export const AUTH_DRIZZLE_SCHEMA = Object.freeze({
  ...BETTER_AUTH_DRIZZLE_SCHEMA,
  userRelations,
  sessionRelations,
  accountRelations,
});
