/**
 * Phase 5C — Character reuse across Dynaxis Studios.
 *
 * Covers the shared Character Consumer, deterministic reference selection,
 * visual-context projection, video model capability checks, and generation
 * provenance publishing. No MuAPI / LLM calls — everything is pure or mocked,
 * so no paid credits are consumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IDENTITY_ROLE_PRIORITY,
  normaliseCharacterAssetLinks,
  selectCharacterReferences,
  buildVisualDescription,
  buildCharacterVisualContext,
  resolveCharacterContext,
  publishCharacterGenerationContext,
  clearCharacterGenerationContext,
  readCharacterGenerationContext,
} from '../lib/dynaxis/characters/consumer.js';
import {
  getVideoImageCapability,
  characterSupportedForVideoCapability,
} from '../lib/dynaxis/characters/video-capabilities.js';

// ── fixtures ────────────────────────────────────────────────────────────────

function assetLinks() {
  return [
    {
      assetId: 'a-style',
      asset: { id: 'a-style', url: 'https://cdn/style.jpg', type: 'image' },
      role: 'style_reference',
      sortOrder: 3,
    },
    {
      assetId: 'a-primary',
      asset: { id: 'a-primary', url: 'https://cdn/primary.jpg', type: 'image' },
      role: 'identity_reference',
      isPrimary: true,
      sortOrder: 1,
    },
    {
      assetId: 'a-portrait',
      asset: { id: 'a-portrait', url: 'https://cdn/portrait.jpg', type: 'image' },
      role: 'generated_portrait',
      sortOrder: 2,
    },
    // non-image asset should be filtered out of visual references
    {
      assetId: 'a-audio',
      asset: { id: 'a-audio', url: 'https://cdn/voice.mp3', type: 'audio' },
      role: 'voice_reference',
    },
  ];
}

function mockCharacterClient(overrides = {}) {
  const calls = { getCharacter: [], listRevisions: [], link: [] };
  const client = {
    calls,
    getCharacter: async (id, query) => {
      calls.getCharacter.push({ id, query });
      return {
        character: {
          id,
          name: 'Nova',
          category: 'influencer',
          description: 'A neon-lit cyberpunk explorer',
          persona: 'Confident, witty, always curious',
          systemPrompt: 'SECRET CHAT INSTRUCTIONS — must not leak into images',
          currentRevisionId: 'rev-1',
          primaryAssetId: 'a-primary',
          assets: assetLinks(),
        },
      };
    },
    listCharacterRevisions: async (id) => {
      calls.listRevisions.push(id);
      return { revisions: [{ id: 'rev-1', revisionNumber: 1 }] };
    },
    linkCharacterToProject: async (id, body) => {
      calls.link.push({ id, body });
      return {};
    },
    ...overrides,
  };
  return client;
}

// ── normalise + select ──────────────────────────────────────────────────────

test('normaliseCharacterAssetLinks flattens links and sorts primary first', () => {
  const out = normaliseCharacterAssetLinks(assetLinks());
  // audio asset filtered out
  assert.equal(out.length, 3);
  assert.equal(out[0].assetId, 'a-primary');
  assert.equal(out[0].isPrimary, true);
  assert.ok(out.every((a) => a.type === 'image'));
});

test('selectCharacterReferences honours maxImages and identity priority', () => {
  const sel = selectCharacterReferences(assetLinks(), { maxImages: 1 });
  assert.equal(sel.references.length, 1);
  assert.equal(sel.assetIds[0], 'a-primary');
  assert.equal(sel.urls[0], 'https://cdn/primary.jpg');
  assert.equal(sel.truncated, true);
});

test('selectCharacterReferences respects explicit user selection', () => {
  const sel = selectCharacterReferences(assetLinks(), {
    maxImages: 2,
    selectedAssetIds: ['a-portrait', 'a-style'],
  });
  assert.deepEqual(sel.assetIds, ['a-portrait', 'a-style']);
});

test('selectCharacterReferences returns empty when budget is zero', () => {
  const sel = selectCharacterReferences(assetLinks(), { maxImages: 0 });
  assert.equal(sel.references.length, 0);
  assert.equal(sel.urls.length, 0);
});

test('IDENTITY_ROLE_PRIORITY ranks identity_reference above generated_portrait', () => {
  assert.ok(
    IDENTITY_ROLE_PRIORITY.indexOf('identity_reference') <
      IDENTITY_ROLE_PRIORITY.indexOf('generated_portrait'),
  );
});

// ── visual description (no chat leakage) ─────────────────────────────────────

test('buildVisualDescription includes visual fields and excludes systemPrompt', () => {
  const desc = buildVisualDescription({
    name: 'Nova',
    description: 'A neon-lit cyberpunk explorer',
    persona: 'Confident, witty',
    systemPrompt: 'SECRET CHAT INSTRUCTIONS',
    greeting: 'Hi there!',
  });
  assert.ok(desc.includes('Nova'));
  assert.ok(desc.includes('neon-lit'));
  assert.ok(!desc.includes('SECRET'));
  assert.ok(!desc.includes('Hi there'));
});

test('buildCharacterVisualContext projects ids, references and continuity', () => {
  const ctx = buildCharacterVisualContext({
    character: { id: 'char-1', name: 'Nova', currentRevisionId: 'rev-1' },
    assets: assetLinks(),
  });
  assert.equal(ctx.characterId, 'char-1');
  assert.equal(ctx.characterRevisionId, 'rev-1');
  assert.equal(ctx.continuity, 'reference-based');
  assert.ok(ctx.referenceAssetIds.length >= 1);
});

// ── resolveCharacterContext (mock client) ────────────────────────────────────

test('resolveCharacterContext requires a client and characterId', async () => {
  await assert.rejects(() => resolveCharacterContext(null, 'char-1'), /client/i);
  await assert.rejects(
    () => resolveCharacterContext(mockCharacterClient(), null),
    /characterId/i,
  );
});

test('resolveCharacterContext returns provenance and visual context', async () => {
  const client = mockCharacterClient();
  const resolved = await resolveCharacterContext(client, 'char-1', {
    maxImages: 2,
  });
  assert.equal(resolved.character.id, 'char-1');
  assert.equal(resolved.provenance.characterId, 'char-1');
  assert.equal(resolved.provenance.continuity, 'reference-based');
  assert.ok(resolved.provenance.referenceAssetIds.includes('a-primary'));
  assert.equal(resolved.visual.referenceUrls.length, 2);
  // getCharacter requested with assets included
  assert.equal(client.calls.getCharacter[0].query.includeAssets, 'true');
});

test('resolveCharacterContext pins a specific revision when requested', async () => {
  const client = mockCharacterClient();
  const resolved = await resolveCharacterContext(client, 'char-1', {
    revisionId: 'rev-1',
  });
  assert.equal(resolved.revision.id, 'rev-1');
  assert.equal(resolved.visual.pinnedRevision, true);
  assert.deepEqual(client.calls.listRevisions, ['char-1']);
});

test('resolveCharacterContext links Character to active project when asked', async () => {
  const client = mockCharacterClient();
  await resolveCharacterContext(client, 'char-1', {
    projectId: 'proj-9',
    linkToProject: true,
  });
  assert.equal(client.calls.link.length, 1);
  assert.equal(client.calls.link[0].body.projectId, 'proj-9');
});

test('resolveCharacterContext throws when Character missing', async () => {
  const client = mockCharacterClient({
    getCharacter: async () => ({ character: null }),
  });
  await assert.rejects(
    () => resolveCharacterContext(client, 'ghost'),
    /not found/i,
  );
});

// ── video model capability ───────────────────────────────────────────────────

test('getVideoImageCapability: null model is unsupported', () => {
  const cap = getVideoImageCapability(null);
  assert.equal(cap.supportsImageReference, false);
  assert.equal(cap.characterContinuitySupported, false);
  assert.ok(cap.unsupportedReason);
});

test('getVideoImageCapability: pure T2V model cannot use references', () => {
  const cap = getVideoImageCapability({ id: 't2v', inputs: {} }, {});
  assert.equal(cap.supportsImageReference, false);
  assert.equal(cap.mode, 't2v');
  assert.ok(/text-to-video/i.test(cap.unsupportedReason));
  assert.equal(characterSupportedForVideoCapability(cap), false);
});

test('getVideoImageCapability: single-image I2V supports one reference', () => {
  const cap = getVideoImageCapability(
    { id: 'i2v', imageField: 'image_url', maxImages: 1 },
    { imageMode: true },
  );
  assert.equal(cap.supportsImageReference, true);
  assert.equal(cap.maxImages, 1);
  assert.equal(cap.imageField, 'image_url');
  assert.equal(cap.mode, 'i2v');
  assert.equal(characterSupportedForVideoCapability(cap), true);
});

test('getVideoImageCapability: multi-image I2V uses a list', () => {
  const cap = getVideoImageCapability(
    { id: 'multi', imageField: 'images_list', maxImages: 5 },
    { imageMode: true },
  );
  assert.equal(cap.maxImages, 5);
  assert.equal(cap.usesList, true);
});

test('getVideoImageCapability: extend model with images_list is supported', () => {
  const cap = getVideoImageCapability(
    { id: 'extend', inputs: { images_list: { maxItems: 8 } } },
    { imageMode: false },
  );
  assert.equal(cap.isExtend, true);
  assert.equal(cap.supportsImageReference, true);
  assert.equal(cap.maxImages, 8);
  assert.equal(cap.mode, 'extend');
});

// ── provenance publishing on window ──────────────────────────────────────────

test('publish/read/clear Character generation context via window', () => {
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
      referenceAssetIds: ['a-primary'],
    });
    const ctx = readCharacterGenerationContext();
    assert.equal(ctx.characterId, 'char-1');
    assert.equal(ctx.characterRevisionId, 'rev-1');
    assert.deepEqual(ctx.referenceAssetIds, ['a-primary']);

    clearCharacterGenerationContext();
    const cleared = readCharacterGenerationContext();
    assert.equal(cleared.characterId, null);
    assert.equal(cleared.characterRevisionId, null);
    assert.equal(cleared.referenceAssetIds, null);
  } finally {
    globalThis.window = prevWindow;
    globalThis.CustomEvent = prevCustomEvent;
  }
});

test('readCharacterGenerationContext returns nulls without a window', () => {
  const prevWindow = globalThis.window;
  globalThis.window = undefined;
  try {
    const ctx = readCharacterGenerationContext();
    assert.equal(ctx.characterId, null);
  } finally {
    globalThis.window = prevWindow;
  }
});
