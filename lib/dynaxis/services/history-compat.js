/**
 * Compatibility layer for fragmented hg_* localStorage history.
 * Does NOT destroy local history. Imports are deduped via migrationKey.
 */

import { z } from 'zod';
import { migrationKeyForLocalHistory } from '../ownership.js';
import { createGeneration, updateGenerationStatus } from './generations.js';
import { registerAsset } from './assets.js';
import { ensureDefaultProject } from './projects.js';
import { getPlatformStore } from '../db/store.js';
import { HG_STUDIO_FEATURE_MAP } from '../client/local-history.js';

export { HG_STUDIO_FEATURE_MAP };

export const importHistorySchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  entries: z
    .array(
      z.object({
        studioKey: z.string().min(1),
        url: z.string().url(),
        prompt: z.string().optional().nullable(),
        model: z.string().optional().nullable(),
        createdAt: z.union([z.string(), z.number()]).optional().nullable(),
        type: z.enum(['image', 'video', 'audio', 'other']).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .max(500),
});

/**
 * Import local history entries into Dynaxis Generation + Asset records.
 * Skips duplicates by migrationKey.
 *
 * @param {string} ownerRef
 * @param {z.infer<typeof importHistorySchema>} input
 */
export async function importLocalHistory(ownerRef, input) {
  const data = importHistorySchema.parse(input);
  const project = data.projectId
    ? await (await getPlatformStore()).getProject(ownerRef, data.projectId)
    : await ensureDefaultProject(ownerRef);
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }

  const summary = { imported: 0, skipped: 0, failed: 0, results: [] };
  const store = await getPlatformStore();

  for (const entry of data.entries) {
    const migrationKey = migrationKeyForLocalHistory(entry);
    const existing = await store.findGenerationByMigrationKey(ownerRef, migrationKey);
    if (existing) {
      summary.skipped += 1;
      summary.results.push({ migrationKey, status: 'skipped', generationId: existing.id });
      continue;
    }
    try {
      const featureId = HG_STUDIO_FEATURE_MAP[entry.studioKey] || entry.studioKey;
      const generation = await createGeneration(ownerRef, {
        projectId: project.id,
        featureId,
        model: entry.model,
        prompt: entry.prompt,
        status: 'succeeded',
        migrationKey,
        metadata: {
          importedFrom: 'localStorage',
          studioKey: entry.studioKey,
          originalCreatedAt: entry.createdAt ?? null,
          ...(entry.metadata || {}),
        },
      });
      await updateGenerationStatus(ownerRef, generation.id, 'succeeded');
      const asset = await registerAsset(ownerRef, {
        projectId: project.id,
        generationId: generation.id,
        type: entry.type,
        source: 'imported',
        provider: 'muapi',
        model: entry.model,
        url: entry.url,
        prompt: entry.prompt,
        role: 'primary',
        metadata: { importedFrom: 'localStorage', studioKey: entry.studioKey },
      });
      summary.imported += 1;
      summary.results.push({
        migrationKey,
        status: 'imported',
        generationId: generation.id,
        assetId: asset.id,
      });
    } catch (err) {
      summary.failed += 1;
      summary.results.push({
        migrationKey,
        status: 'failed',
        error: String(err.message || err).slice(0, 200),
      });
    }
  }

  return summary;
}
