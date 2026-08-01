import { z } from 'zod';
import { trackSchema } from './tracks.js';

export const timelineSchema = z
  .object({
    frameRate: z.number().positive().max(240),
    durationMs: z.number().int().positive(),
    tracks: z.array(trackSchema).min(1),
  })
  .superRefine((timeline, ctx) => {
    validateTimelineRules(timeline, ctx);
  });

/**
 * @param {z.infer<typeof timelineSchema>} timeline
 * @param {z.RefinementCtx} [ctx]
 */
export function validateTimelineRules(timeline, ctx = null) {
  const issue = (path, message) => {
    if (ctx) {
      ctx.addIssue({ code: 'custom', path, message });
      return;
    }
    throw new Error(message);
  };

  const seenTrackIds = new Set();
  for (const track of timeline.tracks) {
    if (seenTrackIds.has(track.id)) {
      issue(['tracks'], `duplicate track id: ${track.id}`);
    }
    seenTrackIds.add(track.id);

    for (const clip of track.clips) {
      const clipEnd = clip.startMs + clip.durationMs;
      if (clipEnd > timeline.durationMs) {
        issue(
          ['tracks'],
          `clip ${clip.id} exceeds timeline duration (${clipEnd}ms > ${timeline.durationMs}ms)`
        );
      }
    }
  }
}
