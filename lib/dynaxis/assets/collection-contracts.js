import { z } from 'zod';
import { assetIdSchema } from './asset-references.js';
import { provenanceMetadataSchema } from './usage-contracts.js';

export const ASSET_COLLECTION_KINDS = Object.freeze([
  'playlist',
  'moodboard',
  'template_pack',
  'dataset',
  'archive',
]);

const stableCollectionIdPattern = /^collection_[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;

export const collectionItemReferenceSchema = z.object({
  assetId: assetIdSchema,
  rank: z.number().int().nonnegative(),
  role: z.string().trim().min(1).max(120).optional().nullable(),
});

export const assetCollectionMetadataSchema = z.object({
  id: z.string().trim().regex(stableCollectionIdPattern, 'collection id must be stable and prefixed'),
  kind: z.enum(ASSET_COLLECTION_KINDS),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000).optional().nullable(),
  provenance: provenanceMetadataSchema,
  itemReferences: z.array(collectionItemReferenceSchema).min(1).max(5000),
});

function normalizeIssues(error) {
  if (!error?.issues) {
    return [{ path: '$', message: String(error?.message || 'validation failed') }];
  }
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateAssetCollectionMetadata(input) {
  const parsed = assetCollectionMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
