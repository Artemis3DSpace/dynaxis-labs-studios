import { z } from 'zod';

export const MEDIA_TYPE_CATEGORIES = Object.freeze([
  'image',
  'video',
  'audio',
  'document',
  'model_3d',
]);

export const FILE_METADATA_SOURCE_TYPES = Object.freeze([
  'placeholder',
  'ingested_manifest',
  'external_reference',
]);

const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const nonNegativeNumber = z.number().nonnegative();

export const fileMetadataPlaceholderSchema = z.object({
  sourceType: z.enum(FILE_METADATA_SOURCE_TYPES).default('placeholder'),
  mimeType: z.string().trim().min(1).max(200),
  extension: z.string().trim().min(1).max(20),
  byteSize: nonNegativeInt,
  checksumSha256: z.string().trim().min(1).max(256).optional().nullable(),
  originalFilename: z.string().trim().min(1).max(300).optional().nullable(),
});

export const imageAssetMetadataSchema = z.object({
  mediaType: z.literal('image'),
  width: positiveInt,
  height: positiveInt,
  colorSpace: z.string().trim().min(1).max(64).default('srgb'),
  hasAlpha: z.boolean().default(false),
});

export const videoAssetMetadataSchema = z.object({
  mediaType: z.literal('video'),
  width: positiveInt,
  height: positiveInt,
  durationMs: positiveInt,
  frameRate: nonNegativeNumber,
  codec: z.string().trim().min(1).max(120).optional().nullable(),
});

export const audioAssetMetadataSchema = z.object({
  mediaType: z.literal('audio'),
  durationMs: positiveInt,
  sampleRateHz: positiveInt,
  channels: positiveInt,
  codec: z.string().trim().min(1).max(120).optional().nullable(),
});

export const documentAssetMetadataSchema = z.object({
  mediaType: z.literal('document'),
  pageCount: positiveInt.optional().nullable(),
  language: z.string().trim().min(1).max(32).optional().nullable(),
  hasExtractableText: z.boolean().default(false),
});

export const model3dAssetMetadataSchema = z.object({
  mediaType: z.literal('model_3d'),
  format: z.string().trim().min(1).max(64),
  vertexCount: nonNegativeInt.optional().nullable(),
  triangleCount: nonNegativeInt.optional().nullable(),
  hasMaterials: z.boolean().default(false),
  unitScale: nonNegativeNumber.default(1),
});

export const typedMediaMetadataSchema = z.discriminatedUnion('mediaType', [
  imageAssetMetadataSchema,
  videoAssetMetadataSchema,
  audioAssetMetadataSchema,
  documentAssetMetadataSchema,
  model3dAssetMetadataSchema,
]);

export const mediaMetadataSchema = z.object({
  file: fileMetadataPlaceholderSchema,
  details: typedMediaMetadataSchema,
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

export function validateMediaMetadata(input) {
  const parsed = mediaMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
