import { z } from 'zod';

const isoTimestampSchema = z.string().datetime({ offset: true });

export const ACTIVITY_EVENT_KINDS = /** @type {const} */ ([
  'workspace.updated',
  'workspace.member_added',
  'workspace.member_removed',
  'project.created',
  'project.updated',
  'project.archived',
  'job.created',
  'job.completed',
  'agent.invoked',
  'agent.completed',
]);

export const ACTIVITY_SEVERITIES = /** @type {const} */ (['info', 'notice', 'warning', 'critical']);

export const ACTIVITY_VISIBILITIES = /** @type {const} */ (['public', 'internal', 'private']);

export const ActivityKindSchema = z.enum(ACTIVITY_EVENT_KINDS);
export const ActivitySeveritySchema = z.enum(ACTIVITY_SEVERITIES);
export const ActivityVisibilitySchema = z.enum(ACTIVITY_VISIBILITIES);

export const ActorReferenceSchema = z.object({
  type: z.string().trim().min(1),
  id: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).optional(),
});

export const SourceReferenceSchema = z.object({
  system: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  reference: z.string().trim().min(1).optional(),
});

const ActivityEventBaseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1),
  actor: ActorReferenceSchema,
  source: SourceReferenceSchema,
  kind: ActivityKindSchema,
  severity: ActivitySeveritySchema.default('info'),
  visibility: ActivityVisibilitySchema.default('internal'),
  timestamp: isoTimestampSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const WorkspaceActivityEventSchema = ActivityEventBaseSchema.extend({
  scope: z.literal('workspace').default('workspace'),
  projectId: z.string().trim().min(1).optional(),
});

export const ProjectActivityEventSchema = ActivityEventBaseSchema.extend({
  scope: z.literal('project').default('project'),
  projectId: z.string().trim().min(1),
});

export const ActivityEventSchema = z.union([WorkspaceActivityEventSchema, ProjectActivityEventSchema]);

/**
 * @param {unknown} input
 */
export function validateWorkspaceActivityEvent(input) {
  return WorkspaceActivityEventSchema.parse(input);
}

/**
 * @param {unknown} input
 */
export function validateProjectActivityEvent(input) {
  return ProjectActivityEventSchema.parse(input);
}

/**
 * @param {unknown} value
 */
export function validateActivityVisibility(value) {
  return ActivityVisibilitySchema.parse(value);
}

/**
 * @param {unknown} input
 */
export function validateActivityEvent(input) {
  return ActivityEventSchema.parse(input);
}
