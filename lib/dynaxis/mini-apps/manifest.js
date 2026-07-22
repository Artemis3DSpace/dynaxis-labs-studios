/**
 * Dynaxis Mini App — typed manifest contract + Zod validation.
 */

import { z } from 'zod';
import {
  ASSET_SEMANTIC_ROLES,
  MINI_APP_CATEGORIES,
  MINI_APP_MODULE_TYPES,
  MINI_APP_PERMISSIONS,
  MINI_APP_STATUSES,
} from './permissions.js';
import { ASSET_TYPES } from '../types.js';

const idPattern = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;

export const assetInputSpecSchema = z.object({
  type: z.enum(ASSET_TYPES),
  role: z.enum(ASSET_SEMANTIC_ROLES).optional(),
  required: z.boolean().default(false),
  minCount: z.number().int().nonnegative().default(0),
  maxCount: z.number().int().positive().optional(),
  description: z.string().max(500).optional(),
});

export const miniAppManifestSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(80)
    .regex(idPattern, 'Mini App id must be reverse-dns style, e.g. dynaxis.example'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  version: z.string().trim().min(1).max(40),
  category: z.enum(MINI_APP_CATEGORIES),
  icon: z.string().max(200).optional(),
  status: z.enum(MINI_APP_STATUSES),
  moduleType: z.enum(MINI_APP_MODULE_TYPES).default('capability'),
  viewId: z.string().min(1).max(80),
  route: z.string().min(1).max(200).optional(),
  /** Allowlisted loader key — must match registry loader map */
  entryKey: z.string().min(1).max(120),
  permissions: z.array(z.enum(MINI_APP_PERMISSIONS)).min(0),
  requiredCapabilities: z
    .array(
      z.enum([
        'projects',
        'assets',
        'generations',
        'jobs',
        'muapi',
        'database',
        'characters',
        'products',
        'brands',
        'campaigns',
        'compositions',
        'templates',
        'components',
        'designSystems',
        'componentSets',
      ])
    )
    .default([]),
  assetInputs: z.array(assetInputSpecSchema).default([]),
  assetOutputs: z.array(z.enum(ASSET_TYPES)).default([]),
  modelCapabilities: z.array(z.string().max(80)).default([]),
  requiresProjectContext: z.boolean().default(true),
  requiresGenerationAccess: z.boolean().default(false),
  requiresAssetWrite: z.boolean().default(false),
  requiresExternalNetwork: z.boolean().default(false),
  attribution: z
    .object({
      upstreamName: z.string().optional(),
      upstreamRepo: z.string().url().optional(),
      license: z.string().optional(),
      notes: z.string().max(1000).optional(),
    })
    .optional(),
  featureFlags: z.record(z.string(), z.union([z.boolean(), z.string()])).optional(),
  /** Upstream repos this integrated module supersedes in the Apps catalogue */
  replacesCatalogueRepos: z.array(z.string().url()).optional(),
  /** Machine-readable summary for future Skills / Supercomputer */
  capabilitySummary: z
    .object({
      does: z.string().max(500),
      inputs: z.array(z.string()).default([]),
      outputs: z.array(z.string()).default([]),
      modality: z.enum(['image', 'video', 'audio', 'multimodal', 'text', 'other']).optional(),
    })
    .optional(),
});

/**
 * @typedef {z.infer<typeof miniAppManifestSchema>} MiniAppManifest
 */

/**
 * @param {unknown} input
 * @returns {MiniAppManifest}
 */
export function parseMiniAppManifest(input) {
  return miniAppManifestSchema.parse(input);
}

/**
 * @param {unknown} input
 * @returns {{ success: true, data: MiniAppManifest } | { success: false, error: z.ZodError }}
 */
export function safeParseMiniAppManifest(input) {
  return miniAppManifestSchema.safeParse(input);
}

/**
 * Cross-check permissions against declared requirements.
 * @param {MiniAppManifest} manifest
 * @returns {string[]}
 */
export function validateManifestConsistency(manifest) {
  const warnings = [];
  if (manifest.requiresGenerationAccess) {
    for (const p of ['generation:create', 'jobs:create', 'models:use']) {
      if (!manifest.permissions.includes(/** @type {any} */ (p))) {
        warnings.push(`requiresGenerationAccess but missing permission ${p}`);
      }
    }
  }
  if (manifest.requiresAssetWrite && !manifest.permissions.includes('assets:write')) {
    warnings.push('requiresAssetWrite but missing permission assets:write');
  }
  if (manifest.requiresProjectContext && !manifest.permissions.includes('project:read')) {
    warnings.push('requiresProjectContext but missing permission project:read');
  }
  if (manifest.requiresExternalNetwork && !manifest.permissions.includes('external:network')) {
    warnings.push('requiresExternalNetwork but missing permission external:network');
  }
  return warnings;
}
