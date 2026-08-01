import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMediaMetadata,
  typedMediaMetadataSchema,
  MEDIA_TYPE_CATEGORIES,
} from '../lib/dynaxis/assets/index.js';

test('valid media metadata passes for all required categories', () => {
  assert.deepEqual(MEDIA_TYPE_CATEGORIES, ['image', 'video', 'audio', 'document', 'model_3d']);

  const fixtures = [
    {
      file: { sourceType: 'placeholder', mimeType: 'image/png', extension: 'png', byteSize: 1000 },
      details: { mediaType: 'image', width: 1920, height: 1080, colorSpace: 'srgb' },
    },
    {
      file: { sourceType: 'placeholder', mimeType: 'video/mp4', extension: 'mp4', byteSize: 5000 },
      details: { mediaType: 'video', width: 1920, height: 1080, durationMs: 3000, frameRate: 24 },
    },
    {
      file: { sourceType: 'placeholder', mimeType: 'audio/mpeg', extension: 'mp3', byteSize: 2000 },
      details: { mediaType: 'audio', durationMs: 2000, sampleRateHz: 44100, channels: 2 },
    },
    {
      file: {
        sourceType: 'placeholder',
        mimeType: 'application/pdf',
        extension: 'pdf',
        byteSize: 3000,
      },
      details: { mediaType: 'document', pageCount: 4, hasExtractableText: true },
    },
    {
      file: { sourceType: 'placeholder', mimeType: 'model/gltf-binary', extension: 'glb', byteSize: 7000 },
      details: { mediaType: 'model_3d', format: 'glb', triangleCount: 1200, hasMaterials: true },
    },
  ];

  for (const fixture of fixtures) {
    const result = validateMediaMetadata(fixture);
    assert.equal(result.ok, true);
  }
});

test('invalid media type rejected', () => {
  const result = validateMediaMetadata({
    file: { sourceType: 'placeholder', mimeType: 'application/octet-stream', extension: 'bin', byteSize: 10 },
    details: {
      mediaType: 'binary',
    },
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /mediaType|Invalid discriminator value/i);
});

test('typed media discriminated union rejects mismatched shape', () => {
  const parsed = typedMediaMetadataSchema.safeParse({
    mediaType: 'image',
    durationMs: 1000,
  });
  assert.equal(parsed.success, false);
});
