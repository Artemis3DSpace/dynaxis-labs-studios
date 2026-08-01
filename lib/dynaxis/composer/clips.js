import { z } from 'zod';
import { mediaReferenceSchema, generativeBlockPlaceholderSchema } from './media-contracts.js';

export const clipKinds = /** @type {const} */ (['media', 'generative', 'gap']);

const clipBaseSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  kind: z.enum(clipKinds),
  label: z.string().trim().min(1).max(120).optional().nullable(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  trimInMs: z.number().int().nonnegative().default(0),
  trimOutMs: z.number().int().nonnegative().default(0),
  layerOrder: z.number().int().default(0),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
});

const mediaClipSchema = clipBaseSchema.extend({
  kind: z.literal('media'),
  mediaRef: mediaReferenceSchema,
  generativeBlock: z.undefined().optional(),
});

const generativeClipSchema = clipBaseSchema.extend({
  kind: z.literal('generative'),
  generativeBlock: generativeBlockPlaceholderSchema,
  mediaRef: z.undefined().optional(),
});

const gapClipSchema = clipBaseSchema.extend({
  kind: z.literal('gap'),
  mediaRef: z.undefined().optional(),
  generativeBlock: z.undefined().optional(),
});

export const clipSchema = z
  .discriminatedUnion('kind', [mediaClipSchema, generativeClipSchema, gapClipSchema])
  .superRefine((clip, ctx) => {
    validateClipTiming(clip, ctx);
  });

/**
 * @param {z.infer<typeof clipSchema>} clip
 * @param {z.RefinementCtx} [ctx]
 */
export function validateClipTiming(clip, ctx = null) {
  const issue = (path, message) => {
    if (ctx) {
      ctx.addIssue({ code: 'custom', path, message });
      return;
    }
    throw new Error(message);
  };

  const contentDurationMs = clip.durationMs - clip.trimInMs - clip.trimOutMs;
  if (contentDurationMs <= 0) {
    issue(
      ['durationMs'],
      'clip duration must exceed trimInMs + trimOutMs to leave positive visible media duration'
    );
  }
}
