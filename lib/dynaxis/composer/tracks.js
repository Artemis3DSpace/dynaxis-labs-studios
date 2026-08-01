import { z } from 'zod';
import { clipSchema } from './clips.js';

export const trackSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    kind: z.enum(['video', 'audio', 'effects', 'overlay']),
    allowOverlaps: z.boolean().default(false),
    clips: z.array(clipSchema).default([]),
  })
  .superRefine((track, ctx) => {
    validateTrackRules(track, ctx);
  });

/**
 * @param {z.infer<typeof trackSchema>} track
 * @param {z.RefinementCtx} [ctx]
 */
export function validateTrackRules(track, ctx = null) {
  const issue = (path, message) => {
    if (ctx) {
      ctx.addIssue({ code: 'custom', path, message });
      return;
    }
    throw new Error(message);
  };

  const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  for (const clip of ordered) {
    if (clip.trackId !== track.id) {
      issue(['clips'], `clip ${clip.id} trackId must equal parent track id`);
    }
  }

  if (!track.allowOverlaps) {
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      const prevEnd = prev.startMs + prev.durationMs;
      if (curr.startMs < prevEnd) {
        issue(
          ['clips'],
          `overlapping clips are forbidden on track ${track.id}: ${prev.id} overlaps ${curr.id}`
        );
      }
    }
  }
}
