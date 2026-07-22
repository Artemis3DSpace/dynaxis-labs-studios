/**
 * Phase 6B — Marketing Studio Product / Character / Asset integration.
 * Pure helpers + mocked MuAPI; no paid credits.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKETING_MAX_IMAGES,
  getMarketingModelCapability,
  resolveProductImageSource,
  resolveAvatarImageSource,
  buildOrderedImageList,
  validateMarketingImageBudget,
  buildMarketingPrompt,
  resolveMarketingSourceContext,
  publishMarketingGenerationContext,
  clearMarketingGenerationContext,
} from '../lib/dynaxis/marketing/source-context.js';
import { buildProviderPayload } from '../lib/dynaxis/mini-apps/execute-generation.js';

const PRODUCT_URL = 'https://cdn.muapi.ai/examples/product.jpg';
const PRODUCT_URL_2 = 'https://cdn.muapi.ai/examples/product-2.jpg';
const AVATAR_URL = 'https://cdn.muapi.ai/examples/avatar.jpg';
const PRESET_URL = 'https://d3adwkbyhxyrtq.cloudfront.net/web-app/Priya.webp';
const EXTRA_URL = 'https://cdn.muapi.ai/examples/extra.jpg';

test('marketing model capability: Seedance VIP omni max 9 images', () => {
  const cap = getMarketingModelCapability('1080p');
  assert.equal(cap.maxImages, 9);
  assert.equal(cap.endpoint, 'sd-2-vip-omni-reference-1080p');
  assert.equal(getMarketingModelCapability('720p').endpoint, 'seedance-2-vip-omni-reference');
});

test('product source precedence: upload > asset > product refs', () => {
  const refs = [{ assetId: 'a1', url: PRODUCT_URL, role: 'product_reference' }];
  assert.equal(
    resolveProductImageSource({
      uploadedUrl: PRODUCT_URL_2,
      asset: { id: 'x', url: PRODUCT_URL },
      productReferences: refs,
    }).kind,
    'upload'
  );
  assert.equal(
    resolveProductImageSource({
      asset: { id: 'x', url: PRODUCT_URL },
      productReferences: refs,
    }).kind,
    'asset'
  );
  assert.equal(
    resolveProductImageSource({ productReferences: refs }).kind,
    'product'
  );
  assert.equal(resolveProductImageSource({}).kind, 'none');
});

test('avatar source precedence: upload > asset > character > preset', () => {
  assert.equal(
    resolveAvatarImageSource({
      uploadedUrl: AVATAR_URL,
      asset: { id: 'a', url: EXTRA_URL },
      characterReference: { assetId: 'c', url: PRODUCT_URL },
      preset: { id: 'p', name: 'Priya', url: PRESET_URL },
    }).kind,
    'upload'
  );
  assert.equal(
    resolveAvatarImageSource({
      asset: { id: 'a', url: EXTRA_URL },
      characterReference: { assetId: 'c', url: PRODUCT_URL },
      preset: { id: 'p', name: 'Priya', url: PRESET_URL },
    }).kind,
    'asset'
  );
  assert.equal(
    resolveAvatarImageSource({
      characterReference: { assetId: 'c', url: PRODUCT_URL },
      preset: { id: 'p', name: 'Priya', url: PRESET_URL },
    }).kind,
    'character'
  );
  const preset = resolveAvatarImageSource({
    preset: { id: 'aa252283-8591-4d14-91a8-41ce54187992', name: 'Priya', url: PRESET_URL },
  });
  assert.equal(preset.kind, 'preset');
  assert.equal(preset.preset.name, 'Priya');
});

test('deterministic image ordering and dedupe', () => {
  const ordered = buildOrderedImageList({
    productUrls: [PRODUCT_URL, PRODUCT_URL_2, PRODUCT_URL],
    avatarUrl: AVATAR_URL,
    additionalUrls: [EXTRA_URL, PRODUCT_URL],
  });
  assert.deepEqual(ordered.urls, [PRODUCT_URL, PRODUCT_URL_2, AVATAR_URL, EXTRA_URL]);
  assert.equal(ordered.slots[0].role, 'product_primary');
  assert.equal(ordered.slots[2].role, 'avatar');
});

test('combined reference budget rejects overflow', () => {
  assert.throws(
    () =>
      validateMarketingImageBudget(
        Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/${i}.jpg`)
      ),
    (e) => e.code === 'TOO_MANY_REFERENCES'
  );
  const ok = validateMarketingImageBudget(
    Array.from({ length: 9 }, (_, i) => `https://cdn.example.com/${i}.jpg`)
  );
  assert.equal(ok.count, 9);
});

test('marketing without Product/Character remains functional', () => {
  const ctx = resolveMarketingSourceContext({
    prompt: 'Show the bottle on a sunny beach',
    productUploadUrl: PRODUCT_URL,
    avatarPreset: { id: 'aa252283-8591-4d14-91a8-41ce54187992', name: 'Priya', url: PRESET_URL },
    format: { id: 1, name: 'UGC', url: 'https://d3adwkbyhxyrtq.cloudfront.net/web-app/ugc.mp4' },
    aspectRatio: '9:16',
    resolution: '1080p',
    duration: 5,
  });
  assert.equal(ctx.productId, null);
  assert.equal(ctx.characterId, null);
  assert.equal(ctx.avatarSource.kind, 'preset');
  assert.equal(ctx.provenance.avatarPreset.name, 'Priya');
  assert.deepEqual(ctx.imagesList, [PRODUCT_URL, PRESET_URL]);
  assert.equal(ctx.videoFiles.length, 1);
  assert.match(ctx.prompt, /Show the bottle/);
});

test('Product selection records revision provenance without mutating Product', () => {
  const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const revisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const assetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const ctx = resolveMarketingSourceContext({
    prompt: 'UGC unboxing',
    product: {
      id: productId,
      name: 'Bottle',
      visualDescription: 'Matte black bottle',
      currentRevisionId: revisionId,
    },
    productRevision: { id: revisionId },
    productAssets: [
      {
        assetId,
        url: PRODUCT_URL,
        role: 'product_reference',
        isPrimary: true,
      },
      {
        assetId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        url: PRODUCT_URL_2,
        role: 'packaging_reference',
      },
    ],
    selectedProductAssetIds: [assetId, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
    avatarPreset: { id: 'p', name: 'Priya', url: PRESET_URL },
  });
  assert.equal(ctx.productId, productId);
  assert.equal(ctx.productRevisionId, revisionId);
  assert.deepEqual(ctx.productReferenceAssetIds, [
    assetId,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ]);
  assert.equal(ctx.productSource.kind, 'product');
  assert.ok(ctx.imagesList[0] === PRODUCT_URL);
  assert.match(ctx.prompt, /Matte black bottle/);
});

test('Character selection records revision; preset does not fabricate Character id', () => {
  const characterId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const revisionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const refId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  const withChar = resolveMarketingSourceContext({
    prompt: 'Host presents the product',
    productUploadUrl: PRODUCT_URL,
    character: {
      id: characterId,
      name: 'Aria',
      description: 'Calm host',
      currentRevisionId: revisionId,
    },
    characterRevision: { id: revisionId },
    characterAssets: [
      { assetId: refId, url: AVATAR_URL, role: 'identity_reference', isPrimary: true },
    ],
    selectedCharacterAssetIds: [refId],
  });
  assert.equal(withChar.characterId, characterId);
  assert.equal(withChar.characterRevisionId, revisionId);
  assert.equal(withChar.characterReferenceAssetId, refId);
  assert.equal(withChar.avatarSource.kind, 'character');

  const presetOnly = resolveMarketingSourceContext({
    prompt: 'Host presents the product',
    productUploadUrl: PRODUCT_URL,
    avatarPreset: { id: 'preset-1', name: 'Elena', url: PRESET_URL },
  });
  assert.equal(presetOnly.characterId, null);
  assert.equal(presetOnly.characterRevisionId, null);
  assert.equal(presetOnly.provenance.avatarPreset.name, 'Elena');
});

test('Product + Character + additional refs and exact max', () => {
  const extras = Array.from({ length: 6 }, (_, i) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, '0')}`,
    url: `https://cdn.muapi.ai/extra/${i}.jpg`,
  }));
  const ctx = resolveMarketingSourceContext({
    prompt: 'Full pack',
    product: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Bottle',
      currentRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    productAssets: [
      {
        assetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        url: PRODUCT_URL,
        role: 'product_reference',
        isPrimary: true,
      },
    ],
    character: {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      name: 'Host',
      currentRevisionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    },
    characterAssets: [
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99',
        url: AVATAR_URL,
        role: 'identity_reference',
      },
    ],
    additionalAssets: extras,
  });
  // 1 product + 1 avatar + 6 extras = 8 ≤ 9
  assert.equal(ctx.imagesList.length, 8);
  assert.equal(ctx.imagesList[0], PRODUCT_URL);
  assert.equal(ctx.imagesList[1], AVATAR_URL);
  assert.equal(ctx.orderedInputAssetIds.length >= 2, true);
});

test('overflow with Product multi-ref + avatar + extras is rejected', () => {
  const productRefs = Array.from({ length: 8 }, (_, i) => ({
    assetId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, '0')}`,
    url: `https://cdn.muapi.ai/p/${i}.jpg`,
    role: 'product_reference',
    isPrimary: i === 0,
  }));
  assert.throws(
    () =>
      resolveMarketingSourceContext({
        prompt: 'Too many',
        product: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'X',
          currentRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
        productAssets: productRefs,
        selectedProductAssetIds: productRefs.map((r) => r.assetId),
        avatarPreset: { id: 'p', name: 'Priya', url: PRESET_URL },
        additionalUploadUrls: [EXTRA_URL],
      }),
    (e) => e.code === 'TOO_MANY_REFERENCES'
  );
});

test('upload wins over Product — no Product provenance when upload active', () => {
  const ctx = resolveMarketingSourceContext({
    prompt: 'Manual product shot',
    productUploadUrl: PRODUCT_URL_2,
    product: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Ignored',
      currentRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    productAssets: [
      {
        assetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        url: PRODUCT_URL,
        role: 'product_reference',
      },
    ],
  });
  // Caller should clear Product when uploading; if both passed, upload precedence
  // still uses upload URL. Provenance productId only when kind===product.
  assert.equal(ctx.productSource.kind, 'upload');
  assert.equal(ctx.productId, null);
  assert.deepEqual(ctx.imagesList, [PRODUCT_URL_2]);
});

test('prompt supplements script without replacing it', () => {
  const prompt = buildMarketingPrompt({
    userScript: 'Say hello to the camera',
    productVisualDescription: 'Teal lid bottle',
    characterVisualDescription: 'Calm host',
  });
  assert.match(prompt, /^Say hello to the camera/);
  assert.match(prompt, /Teal lid bottle/);
  assert.match(prompt, /Calm host/);
});

test('publish marketing context sets product + character window bridges', () => {
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
    publishMarketingGenerationContext({
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      productReferenceAssetIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      characterId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      characterRevisionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      characterReferenceAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      orderedInputAssetIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      format: { id: 1, name: 'UGC' },
      avatarSource: { kind: 'character' },
      productSource: { kind: 'product' },
      provenance: { consumer: 'marketing-studio' },
    });
    assert.equal(window.__dynaxisProductId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(window.__dynaxisCharacterId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.equal(window.__dynaxisGenerationMetadata.formatName, 'UGC');
    clearMarketingGenerationContext();
    assert.equal(window.__dynaxisProductId, null);
    assert.equal(window.__dynaxisCharacterId, null);
  } finally {
    globalThis.window = prevWindow;
    globalThis.CustomEvent = prevCustomEvent;
  }
});

test('Dynaxis-only keys are stripped from provider payloads', () => {
  const payload = buildProviderPayload({
    prompt: 'ad',
    parameters: {
      prompt: 'ad',
      images_list: [PRODUCT_URL],
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      characterId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      scenePreset: 'x',
    },
  });
  assert.equal(payload.productId, undefined);
  assert.equal(payload.characterId, undefined);
});

test('MARKETING_MAX_IMAGES constant is 9', () => {
  assert.equal(MARKETING_MAX_IMAGES, 9);
});
