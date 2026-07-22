/**
 * Phase 5E — Character-aware Lip Sync source resolution & provenance tests.
 * Pure helpers only — MuAPI mocked, no paid credits.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIPSYNC_PORTRAIT_ROLES,
  getLipSyncModelCapability,
  resolveImageSource,
  resolveVideoSource,
  resolveAudioSource,
  selectLipSyncPortraitReference,
  resolveLipSyncSourceContext,
  buildLipSyncRequestParams,
} from '../lib/dynaxis/characters/lipsync-source.js';
import {
  publishCharacterGenerationContext,
  clearCharacterGenerationContext,
  readCharacterGenerationContext,
  normaliseCharacterAssetLinks,
} from '../lib/dynaxis/characters/consumer.js';

const IMG = 'https://cdn.muapi.ai/char/portrait.jpg';
const VID = 'https://cdn.muapi.ai/out/video.mp4';
const AUD = 'https://cdn.muapi.ai/out/speech.mp3';
const UPLOAD_IMG = 'https://cdn.muapi.ai/upload/img.jpg';
const UPLOAD_VID = 'https://cdn.muapi.ai/upload/vid.mp4';
const UPLOAD_AUD = 'https://cdn.muapi.ai/upload/aud.mp3';

function characterAssets() {
  return normaliseCharacterAssetLinks([
    {
      assetId: 'ref-style',
      asset: { id: 'ref-style', url: 'https://cdn/style.jpg', type: 'image' },
      role: 'style_reference',
      sortOrder: 3,
    },
    {
      assetId: 'ref-primary',
      asset: { id: 'ref-primary', url: IMG, type: 'image' },
      role: 'identity_reference',
      isPrimary: true,
      sortOrder: 1,
    },
    {
      assetId: 'ref-gen',
      asset: { id: 'ref-gen', url: 'https://cdn/gen.jpg', type: 'image' },
      role: 'generated_portrait',
      sortOrder: 2,
    },
  ]);
}

function mockCharacterContext(overrides = {}) {
  const assets = characterAssets();
  return {
    character: {
      id: 'char-1',
      name: 'Nova',
      description: 'Cyberpunk explorer',
      persona: 'Curious',
      systemPrompt: 'SECRET — must not leak',
      currentRevisionId: 'rev-1',
    },
    revision: { id: 'rev-1', revisionNumber: 1 },
    visual: {
      allAssets: assets,
      referenceAssetIds: ['ref-primary'],
      visualDescription: 'Nova. Cyberpunk explorer',
    },
    provenance: {
      characterId: 'char-1',
      characterRevisionId: 'rev-1',
      referenceAssetIds: ['ref-primary'],
      continuity: 'reference-based',
    },
    ...overrides,
  };
}

// ── model capability ─────────────────────────────────────────────────────────

test('getLipSyncModelCapability: image model with prompt/resolution/seed', () => {
  const cap = getLipSyncModelCapability({
    category: 'image',
    hasPrompt: true,
    hasSeed: true,
    inputs: { resolution: { enum: ['480p', '720p'], default: '480p' } },
  });
  assert.equal(cap.supportsImage, true);
  assert.equal(cap.supportsVideo, false);
  assert.equal(cap.hasPrompt, true);
  assert.equal(cap.hasSeed, true);
  assert.equal(cap.hasResolution, true);
  assert.equal(cap.defaultResolution, '480p');
});

test('getLipSyncModelCapability: video model without prompt', () => {
  const cap = getLipSyncModelCapability({
    category: 'video',
    hasPrompt: false,
  });
  assert.equal(cap.supportsVideo, true);
  assert.equal(cap.supportsImage, false);
  assert.equal(cap.hasPrompt, false);
});

// ── source precedence ────────────────────────────────────────────────────────

test('resolveImageSource: upload beats asset and character', () => {
  const src = resolveImageSource({
    uploadedImageUrl: UPLOAD_IMG,
    imageAsset: { id: 'a1', url: IMG },
    characterReference: { assetId: 'ref-primary', url: IMG },
  });
  assert.equal(src.kind, 'upload');
  assert.equal(src.url, UPLOAD_IMG);
  assert.equal(src.assetId, null);
});

test('resolveImageSource: Project Asset when no upload', () => {
  const src = resolveImageSource({
    imageAsset: { id: 'a1', url: IMG },
    characterReference: { assetId: 'ref-primary', url: 'https://cdn/other.jpg' },
  });
  assert.equal(src.kind, 'asset');
  assert.equal(src.assetId, 'a1');
});

test('resolveImageSource: Character reference when no upload/asset', () => {
  const src = resolveImageSource({
    characterReference: { assetId: 'ref-primary', url: IMG, role: 'identity_reference' },
  });
  assert.equal(src.kind, 'character_reference');
  assert.equal(src.characterReferenceAssetId, 'ref-primary');
});

test('resolveVideoSource: upload beats asset', () => {
  const src = resolveVideoSource({
    uploadedVideoUrl: UPLOAD_VID,
    videoAsset: { id: 'v1', url: VID },
  });
  assert.equal(src.kind, 'upload');
});

test('resolveVideoSource: Project video Asset', () => {
  const src = resolveVideoSource({ videoAsset: { id: 'v1', url: VID } });
  assert.equal(src.kind, 'asset');
  assert.equal(src.assetId, 'v1');
});

test('resolveAudioSource: upload and asset (never Voice Identity)', () => {
  assert.equal(
    resolveAudioSource({ uploadedAudioUrl: UPLOAD_AUD }).kind,
    'upload',
  );
  const a = resolveAudioSource({ audioAsset: { id: 'aud-1', url: AUD } });
  assert.equal(a.kind, 'asset');
  assert.equal(a.assetId, 'aud-1');
});

test('selectLipSyncPortraitReference prefers identity_reference / explicit choice', () => {
  const auto = selectLipSyncPortraitReference(characterAssets());
  assert.equal(auto.assetId, 'ref-primary');

  const chosen = selectLipSyncPortraitReference(characterAssets(), {
    selectedAssetIds: ['ref-gen'],
  });
  assert.equal(chosen.assetId, 'ref-gen');
  assert.ok(LIPSYNC_PORTRAIT_ROLES.includes('generated_portrait'));
});

// ── full context ─────────────────────────────────────────────────────────────

test('resolveLipSyncSourceContext: image mode with Character portrait + audio Asset', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'image',
    model: { category: 'image', hasPrompt: true },
    audioAsset: { id: 'aud-1', url: AUD },
    characterContext: mockCharacterContext(),
    selectedCharRefIds: ['ref-primary'],
  });
  assert.equal(ctx.ready, true);
  assert.equal(ctx.imageSource.kind, 'character_reference');
  assert.equal(ctx.characterId, 'char-1');
  assert.equal(ctx.characterRevisionId, 'rev-1');
  assert.equal(ctx.characterReferenceAssetId, 'ref-primary');
  assert.equal(ctx.provenance.audioAssetId, 'aud-1');
  assert.ok(!ctx.visualDescription?.includes('SECRET'));
});

test('resolveLipSyncSourceContext: uploaded image wins over Character', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'image',
    uploadedImageUrl: UPLOAD_IMG,
    uploadedAudioUrl: UPLOAD_AUD,
    characterContext: mockCharacterContext(),
    selectedCharRefIds: ['ref-primary'],
  });
  assert.equal(ctx.imageSource.kind, 'upload');
  assert.equal(ctx.characterId, 'char-1'); // Character still associated for provenance
  assert.equal(ctx.characterReferenceAssetId, null); // not used as source
});

test('resolveLipSyncSourceContext: video mode with Asset + explicit Character', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'video',
    model: { category: 'video', hasPrompt: false },
    videoAsset: { id: 'v1', url: VID },
    audioAsset: { id: 'aud-1', url: AUD },
    characterContext: mockCharacterContext(),
  });
  assert.equal(ctx.ready, true);
  assert.equal(ctx.videoSource.kind, 'asset');
  assert.equal(ctx.provenance.sourceVideoAssetId, 'v1');
  assert.equal(ctx.characterId, 'char-1');
  assert.equal(ctx.characterRevisionId, 'rev-1');
});

test('resolveLipSyncSourceContext: preserves Character provenance from video Asset metadata', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'video',
    videoAsset: {
      id: 'v1',
      url: VID,
      metadata: { characterId: 'char-legacy', characterRevisionId: 'rev-legacy' },
    },
    uploadedAudioUrl: UPLOAD_AUD,
  });
  assert.equal(ctx.characterId, 'char-legacy');
  assert.equal(ctx.characterRevisionId, 'rev-legacy');
});

test('resolveLipSyncSourceContext: explicit Character overrides video Asset metadata', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'video',
    videoAsset: {
      id: 'v1',
      url: VID,
      metadata: { characterId: 'char-legacy', characterRevisionId: 'rev-legacy' },
    },
    uploadedAudioUrl: UPLOAD_AUD,
    characterContext: mockCharacterContext(),
  });
  assert.equal(ctx.characterId, 'char-1');
  assert.equal(ctx.characterRevisionId, 'rev-1');
});

test('resolveLipSyncSourceContext: normal Lip Sync without Character', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'image',
    uploadedImageUrl: UPLOAD_IMG,
    uploadedAudioUrl: UPLOAD_AUD,
    model: { category: 'image', hasPrompt: false },
  });
  assert.equal(ctx.ready, true);
  assert.equal(ctx.characterId, null);
  assert.equal(ctx.characterRevisionId, null);
  assert.equal(ctx.imageSource.kind, 'upload');
});

test('resolveLipSyncSourceContext: not ready without audio', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'image',
    uploadedImageUrl: UPLOAD_IMG,
  });
  assert.equal(ctx.ready, false);
});

// ── request params ───────────────────────────────────────────────────────────

test('buildLipSyncRequestParams: image mode with prompt-capable model', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'image',
    model: {
      category: 'image',
      hasPrompt: true,
      hasSeed: true,
      inputs: { resolution: { enum: ['720p'], default: '720p' } },
    },
    uploadedImageUrl: UPLOAD_IMG,
    uploadedAudioUrl: UPLOAD_AUD,
    characterContext: mockCharacterContext(),
  });
  const params = buildLipSyncRequestParams(ctx, {
    modelId: 'ltx-2.3-lipsync',
    prompt: 'Speak clearly',
    resolution: '720p',
    seed: -1,
  });
  assert.equal(params.model, 'ltx-2.3-lipsync');
  assert.equal(params.image_url, UPLOAD_IMG);
  assert.equal(params.audio_url, UPLOAD_AUD);
  assert.ok(params.prompt.includes('Speak clearly'));
  assert.ok(!params.prompt.includes('SECRET'));
  assert.equal(params.resolution, '720p');
  assert.equal(params.seed, -1);
});

test('buildLipSyncRequestParams: video mode without prompt', () => {
  const ctx = resolveLipSyncSourceContext({
    inputMode: 'video',
    model: { category: 'video', hasPrompt: false },
    uploadedVideoUrl: UPLOAD_VID,
    uploadedAudioUrl: UPLOAD_AUD,
  });
  const params = buildLipSyncRequestParams(ctx, { modelId: 'sync-lipsync' });
  assert.equal(params.video_url, UPLOAD_VID);
  assert.equal(params.prompt, undefined);
});

// ── provenance bridge ────────────────────────────────────────────────────────

test('publishCharacterGenerationContext carries Lip Sync generationMetadata', () => {
  const prevWindow = globalThis.window;
  const prevCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class {
    constructor(type, opts) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
  globalThis.window = { dispatchEvent() {} };

  try {
    publishCharacterGenerationContext({
      characterId: 'char-1',
      characterRevisionId: 'rev-1',
      referenceAssetIds: ['ref-primary'],
      generationMetadata: {
        sourceImageAssetId: null,
        audioAssetId: 'aud-1',
        continuity: 'reference-based',
      },
    });
    const ctx = readCharacterGenerationContext();
    assert.equal(ctx.characterId, 'char-1');
    assert.equal(ctx.generationMetadata.audioAssetId, 'aud-1');
    clearCharacterGenerationContext();
    assert.equal(readCharacterGenerationContext().generationMetadata, null);
  } finally {
    globalThis.window = prevWindow;
    globalThis.CustomEvent = prevCustomEvent;
  }
});
