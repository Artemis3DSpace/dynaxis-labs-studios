import { z } from 'zod';
import { timelineSchema } from './timeline.js';
import { renderGraphSchema } from './render-graph.js';
import { effectStackSchema, exportTargetSchema } from './effects-contracts.js';

export const sequenceSchema = z.object({
  version: z.literal(1),
  sequenceId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  timeline: timelineSchema,
  effectStacks: z.record(z.string().uuid(), effectStackSchema).default({}),
  renderGraph: renderGraphSchema,
  exportTargets: z.array(exportTargetSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/**
 * @param {unknown} input
 */
export function parseComposerSequence(input) {
  return sequenceSchema.parse(input);
}

/**
 * @param {unknown} input
 */
export function validateComposerSequence(input) {
  const parsed = parseComposerSequence(input);
  return Object.freeze(parsed);
}
