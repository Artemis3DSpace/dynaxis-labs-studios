import { z } from 'zod';

export const effectInstanceSchema = z.object({
  id: z.string().uuid(),
  effectType: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const effectStackSchema = z.array(effectInstanceSchema).max(64).default([]);

export const exportTargetSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(['video_file', 'image_sequence', 'audio_file']),
    container: z.enum(['mp4', 'mov', 'webm', 'png', 'wav', 'aac']),
    width: z.number().int().positive().max(16384).optional().nullable(),
    height: z.number().int().positive().max(16384).optional().nullable(),
    frameRate: z.number().positive().max(240).optional().nullable(),
    audioSampleRate: z.number().int().positive().max(192000).optional().nullable(),
  })
  .superRefine((target, ctx) => {
    if (target.type === 'video_file') {
      if (!target.width || !target.height || !target.frameRate) {
        ctx.addIssue({
          code: 'custom',
          path: ['type'],
          message: 'video_file export targets require width, height, and frameRate',
        });
      }
      if (!['mp4', 'mov', 'webm'].includes(target.container)) {
        ctx.addIssue({
          code: 'custom',
          path: ['container'],
          message: 'video_file export targets must use mp4, mov, or webm container',
        });
      }
    }

    if (target.type === 'image_sequence') {
      if (!target.width || !target.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['type'],
          message: 'image_sequence export targets require width and height',
        });
      }
      if (target.container !== 'png') {
        ctx.addIssue({
          code: 'custom',
          path: ['container'],
          message: 'image_sequence export targets must use png container',
        });
      }
    }

    if (target.type === 'audio_file') {
      if (!target.audioSampleRate) {
        ctx.addIssue({
          code: 'custom',
          path: ['audioSampleRate'],
          message: 'audio_file export targets require audioSampleRate',
        });
      }
      if (!['wav', 'aac'].includes(target.container)) {
        ctx.addIssue({
          code: 'custom',
          path: ['container'],
          message: 'audio_file export targets must use wav or aac container',
        });
      }
    }
  });
