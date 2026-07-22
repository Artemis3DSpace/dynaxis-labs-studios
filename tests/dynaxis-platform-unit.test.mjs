import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseProviderStatus, inferAssetType } from '../lib/dynaxis/types.js';
import {
  ownerRefFromApiKey,
  migrationKeyForLocalHistory,
  LOCAL_PREVIEW_KEY,
} from '../lib/dynaxis/ownership.js';
import {
  extractOutputUrls,
  safeProviderPayload,
  MuAPIProvider,
} from '../lib/dynaxis/providers/muapi.js';
import { sanitizeErrorMessage } from '../lib/dynaxis/services/jobs.js';

test('ownerRefFromApiKey is stable and does not embed the raw key', () => {
  const a = ownerRefFromApiKey('secret-key-abc');
  const b = ownerRefFromApiKey('secret-key-abc');
  const c = ownerRefFromApiKey('other-key');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.startsWith('ak_sha256:'));
  assert.equal(a.includes('secret-key'), false);
});

test('ownerRefFromApiKey isolates local preview', () => {
  const ref = ownerRefFromApiKey(LOCAL_PREVIEW_KEY);
  assert.equal(ref, 'ak_sha256:preview:local');
});

test('migrationKeyForLocalHistory is deterministic', () => {
  const k1 = migrationKeyForLocalHistory({
    studioKey: 'hg_image_studio_persistent',
    url: 'https://cdn.example/a.png',
    createdAt: 100,
  });
  const k2 = migrationKeyForLocalHistory({
    studioKey: 'hg_image_studio_persistent',
    url: 'https://cdn.example/a.png',
    createdAt: 100,
  });
  const k3 = migrationKeyForLocalHistory({
    studioKey: 'hg_image_studio_persistent',
    url: 'https://cdn.example/b.png',
    createdAt: 100,
  });
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
  assert.ok(k1.startsWith('hg_import:'));
});

test('normaliseProviderStatus maps MuAPI statuses', () => {
  assert.equal(normaliseProviderStatus('completed'), 'succeeded');
  assert.equal(normaliseProviderStatus('succeeded'), 'succeeded');
  assert.equal(normaliseProviderStatus('failed'), 'failed');
  assert.equal(normaliseProviderStatus('processing'), 'processing');
  assert.equal(normaliseProviderStatus('queued'), 'queued');
  assert.equal(normaliseProviderStatus('cancelled'), 'cancelled');
  assert.equal(normaliseProviderStatus('weird'), 'unknown');
});

test('inferAssetType from url and mime', () => {
  assert.equal(inferAssetType({ url: 'https://x/a.mp4' }), 'video');
  assert.equal(inferAssetType({ url: 'https://x/a.png' }), 'image');
  assert.equal(inferAssetType({ mimeType: 'audio/mpeg' }), 'audio');
  assert.equal(inferAssetType({ hint: 'video' }), 'video');
});

test('extractOutputUrls supports multi-output payloads', () => {
  const urls = extractOutputUrls({
    outputs: ['https://cdn.example/1.png', { url: 'https://cdn.example/2.png' }],
    url: 'https://cdn.example/1.png',
  });
  assert.deepEqual(urls, ['https://cdn.example/1.png', 'https://cdn.example/2.png']);
});

test('safeProviderPayload redacts oversized payloads', () => {
  const big = { blob: 'x'.repeat(9000) };
  const safe = safeProviderPayload(big);
  assert.equal(safe.truncated, true);
});

test('sanitizeErrorMessage redacts api keys', () => {
  const msg = sanitizeErrorMessage('fail x-api-key: SUPERSECRET token');
  assert.equal(msg.includes('SUPERSECRET'), false);
  assert.ok(msg.includes('[redacted]'));
});

test('MuAPIProvider.normaliseResult maps success outputs', () => {
  const provider = new MuAPIProvider();
  const result = provider.normaliseResult({
    status: 'completed',
    outputs: ['https://cdn.example/out.mp4'],
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.primaryUrl, 'https://cdn.example/out.mp4');
});

test('MuAPIProvider.submit and retrieve (mocked fetch)', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init?.method || 'GET' });
    if (String(url).includes('/predictions/')) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: 'completed', outputs: ['https://cdn.example/r.png'] }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ request_id: 'req_123' }),
    };
  };
  const provider = new MuAPIProvider({ fetchImpl, apiHost: 'https://api.muapi.ai' });
  const submitted = await provider.submit({
    apiKey: 'k',
    endpoint: 'flux',
    payload: { prompt: 'hi' },
  });
  assert.equal(submitted.providerJobId, 'req_123');
  const retrieved = await provider.retrieve({ apiKey: 'k', providerJobId: 'req_123' });
  assert.equal(retrieved.status, 'succeeded');
  assert.equal(retrieved.primaryUrl, 'https://cdn.example/r.png');
  assert.equal(calls.length, 2);
});

test('MuAPIProvider.submit surfaces HTTP errors', async () => {
  const provider = new MuAPIProvider({
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }),
  });
  await assert.rejects(
    () => provider.submit({ apiKey: 'k', endpoint: 'x', payload: {} }),
    /MuAPI submit failed/
  );
});
