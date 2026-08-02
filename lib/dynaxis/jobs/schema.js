import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organization } from '../auth/schema.js';
import { dynaxisProjects } from '../db/schema.js';
import { JOB_EVENT_NAMES, JOB_STATES, TERMINAL_JOB_STATES } from './contracts.js';

const JOB_STATE_VALUES = Object.values(JOB_STATES);
const JOB_EVENT_VALUES = Object.values(JOB_EVENT_NAMES);

export const DYNAXIS_JOB_FAILURE_KINDS = Object.freeze([
  'transient',
  'permanent',
  'cancelled',
  'timeout',
]);

export const DYNAXIS_JOB_ACTOR_TYPES = Object.freeze([
  'user',
  'service',
  'worker',
  'provider',
  'system',
]);

function asSqlTextList(values) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

export const dynaxisJobRecords = pgTable(
  'dynaxis_job_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id, { onDelete: 'restrict' }),
    generationId: uuid('generation_id'),
    jobKind: text('job_kind').notNull().default('generation'),
    state: text('state').notNull().default(JOB_STATES.QUEUED),
    idempotencyKey: text('idempotency_key').notNull(),
    providerId: text('provider_id'),
    providerConnectionRef: text('provider_connection_ref'),
    providerJobId: text('provider_job_id'),
    providerCorrelation: jsonb('provider_correlation').$type().notNull().default({}),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(1),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
    cancelRequestedBy: text('cancel_requested_by'),
    cancelReason: text('cancel_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    timeoutAt: timestamp('timeout_at', { withTimezone: true }),
    timeoutReason: text('timeout_reason'),
    timedOutAt: timestamp('timed_out_at', { withTimezone: true }),
    failureKind: text('failure_kind'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    failureMetadata: jsonb('failure_metadata').$type().notNull().default({}),
    terminalStateAt: timestamp('terminal_state_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    metadata: jsonb('metadata').$type().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceStateIdx: index('dynaxis_job_records_workspace_state_idx').on(
      table.workspaceId,
      table.state,
      table.updatedAt
    ),
    projectCreatedIdx: index('dynaxis_job_records_project_created_idx').on(
      table.projectId,
      table.createdAt
    ),
    providerLookupIdx: index('dynaxis_job_records_provider_lookup_idx').on(
      table.providerId,
      table.providerJobId
    ),
    idempotencyBoundaryUidx: uniqueIndex('dynaxis_job_records_idempotency_boundary_uidx').on(
      table.workspaceId,
      table.projectId,
      table.jobKind,
      table.idempotencyKey
    ),
    stateCheck: check(
      'dynaxis_job_records_state_check',
      sql`${table.state} in (${asSqlTextList(JOB_STATE_VALUES)})`
    ),
    maxAttemptsCheck: check('dynaxis_job_records_max_attempts_check', sql`${table.maxAttempts} >= 1`),
    attemptCountCheck: check(
      'dynaxis_job_records_attempt_count_check',
      sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= ${table.maxAttempts}`
    ),
    versionCheck: check('dynaxis_job_records_version_check', sql`${table.version} >= 1`),
    failureKindCheck: check(
      'dynaxis_job_records_failure_kind_check',
      sql`${table.failureKind} is null or ${table.failureKind} in (${asSqlTextList(
        DYNAXIS_JOB_FAILURE_KINDS
      )})`
    ),
    terminalStateCheck: check(
      'dynaxis_job_records_terminal_state_check',
      sql`${table.terminalStateAt} is null or ${table.state} in (${asSqlTextList(
        TERMINAL_JOB_STATES
      )})`
    ),
    cancelledStateCheck: check(
      'dynaxis_job_records_cancelled_state_check',
      sql`${table.cancelledAt} is null or ${table.state} = 'cancelled'`
    ),
    completedStateCheck: check(
      'dynaxis_job_records_completed_state_check',
      sql`${table.completedAt} is null or ${table.state} = 'completed'`
    ),
    failedStateCheck: check(
      'dynaxis_job_records_failed_state_check',
      sql`${table.failedAt} is null or ${table.state} = 'failed'`
    ),
  })
);

export const dynaxisJobEvents = pgTable(
  'dynaxis_job_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => dynaxisJobRecords.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id, { onDelete: 'restrict' }),
    sequence: integer('sequence').notNull(),
    kind: text('kind').notNull(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    source: text('source').notNull(),
    attempt: integer('attempt'),
    correlation: jsonb('correlation').$type().notNull().default({}),
    idempotencyKey: text('idempotency_key'),
    payload: jsonb('payload').$type().notNull().default({}),
    providerOccurredAt: timestamp('provider_occurred_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sequenceUidx: uniqueIndex('dynaxis_job_events_job_sequence_uidx').on(table.jobId, table.sequence),
    workspaceCreatedIdx: index('dynaxis_job_events_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt
    ),
    jobCreatedIdx: index('dynaxis_job_events_job_created_idx').on(table.jobId, table.createdAt),
    kindCreatedIdx: index('dynaxis_job_events_kind_created_idx').on(table.kind, table.createdAt),
    kindCheck: check(
      'dynaxis_job_events_kind_check',
      sql`${table.kind} in (${asSqlTextList(JOB_EVENT_VALUES)})`
    ),
    actorTypeCheck: check(
      'dynaxis_job_events_actor_type_check',
      sql`${table.actorType} in (${asSqlTextList(DYNAXIS_JOB_ACTOR_TYPES)})`
    ),
    sequenceCheck: check('dynaxis_job_events_sequence_check', sql`${table.sequence} >= 1`),
    attemptCheck: check(
      'dynaxis_job_events_attempt_check',
      sql`${table.attempt} is null or ${table.attempt} >= 1`
    ),
  })
);

export const dynaxisJobRecordsRelations = relations(dynaxisJobRecords, ({ many }) => ({
  events: many(dynaxisJobEvents),
}));

export const dynaxisJobEventsRelations = relations(dynaxisJobEvents, ({ one }) => ({
  job: one(dynaxisJobRecords, {
    fields: [dynaxisJobEvents.jobId],
    references: [dynaxisJobRecords.id],
  }),
}));

export const DYNAXIS_JOB_DRIZZLE_SCHEMA = Object.freeze({
  dynaxisJobRecords,
  dynaxisJobEvents,
  dynaxisJobRecordsRelations,
  dynaxisJobEventsRelations,
});
