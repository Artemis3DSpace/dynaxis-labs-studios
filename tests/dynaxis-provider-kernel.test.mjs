import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDER_HIGGSFIELD,
  PROVIDER_MUAPI,
  isValidProviderId,
  normalizeProviderId,
  normaliseProviderStatus,
} from '../lib/dynaxis/types.js';
import {
  createProviderRegistry,
  validateGenerationProvider,
  extractOutputUrls,
  safeProviderPayload,
  MuAPIProvider,
  createGenerationGateway,
} from '../lib/dynaxis/server.js';
import { normalizeCapabilityList } from '../lib/dynaxis/providers/capabilities.js';

function makeProvider(providerId = 'test-provider', extra = {}) {
  return {
    providerId,
    capabilities: ['text-to-image'],
    features: { cancel: true },
    metadata: {
      displayName: 'Test Provider',
      metadata: {
        region: 'test',
        apiKey: 'SHOULD_NOT_LEAK',
      },
    },
    submit: async () => ({
      provider: providerId,
      providerJobId: 'job_1',
      status: 'submitted',
      raw: { ok: true, apiKey: 'SECRET' },
    }),
    retrieve: async () => ({
      provider: providerId,
      status: 'completed',
      outputs: ['https://cdn.example/out.png'],
      raw: { status: 'completed' },
    }),
    cancel: async () => ({ supported: true, cancelled: true }),
    ...extra,
  };
}

test('provider ids are extensible strings with known vocabulary constants', () => {
  assert.equal(PROVIDER_MUAPI, 'muapi');
  assert.equal(PROVIDER_HIGGSFIELD, 'higgsfield');
  assert.equal(normalizeProviderId(' MuAPI '), 'muapi');
  assert.equal(isValidProviderId('custom-provider_1'), true);
  assert.equal(isValidProviderId(''), false);
  assert.equal(isValidProviderId('Bad Provider!'), false);
});

test('provider contract validates executable provider shape', () => {
  const provider = makeProvider();
  assert.equal(validateGenerationProvider(provider), provider);
  assert.throws(
    () => validateGenerationProvider({ providerId: 'bad', submit: async () => {} }),
    /missing retrieve/
  );
  assert.throws(
    () =>
      validateGenerationProvider({
        providerId: '',
        submit: async () => {},
        retrieve: async () => {},
        cancel: async () => {},
      }),
    /requires a canonical providerId/
  );
});

test('provider registry supports register, lookup, require, replace, and deterministic list', () => {
  const registry = createProviderRegistry();
  const provider = makeProvider('z-provider');
  registry.register(provider);
  registry.register(makeProvider('a-provider'));
  assert.equal(registry.has('z-provider'), true);
  assert.equal(registry.get('z-provider'), provider);
  assert.equal(registry.require('z-provider'), provider);
  assert.throws(() => registry.register(makeProvider('z-provider')), /already registered/);
  assert.throws(() => registry.require('missing-provider'), (err) => {
    assert.equal(err.code, 'PROVIDER_NOT_FOUND');
    assert.equal(err.providerId, 'missing-provider');
    return true;
  });

  const replacement = makeProvider('z-provider', { metadata: { displayName: 'Replacement' } });
  registry.replace(replacement);
  assert.equal(registry.require('z-provider'), replacement);

  const listed = registry.list();
  assert.deepEqual(listed.map((p) => p.providerId), ['a-provider', 'z-provider']);
  assert.equal(JSON.stringify(listed).includes('SHOULD_NOT_LEAK'), false);
  assert.equal(Object.isFrozen(listed[0].features), true);
});

test('production registry contains only MuAPI', async () => {
  const { createProductionProviderRegistry } = await import('../lib/dynaxis/providers/index.js');
  const registry = createProductionProviderRegistry();
  assert.equal(registry.has(PROVIDER_MUAPI), true);
  assert.equal(registry.has(PROVIDER_HIGGSFIELD), false);
  assert.deepEqual(registry.list().map((p) => p.providerId), [PROVIDER_MUAPI]);
});

test('generic result utilities support MuAPI and generic media shapes', () => {
  const urls = extractOutputUrls({
    request_id: 'r1',
    url: 'https://cdn.example/root.png',
    output: { url: 'https://cdn.example/output.png' },
    outputs: ['https://cdn.example/root.png', { uri: 'https://cdn.example/uri.png' }],
    images: [{ url: 'https://cdn.example/img.webp' }],
    video: 'https://cdn.example/video.mp4',
    audio: { url: 'https://cdn.example/audio.mp3' },
    result: {
      media: {
        files: [{ url: 'https://cdn.example/nested.png' }, { url: 'ftp://bad.example/nope.png' }],
      },
    },
  });
  assert.deepEqual(urls, [
    'https://cdn.example/root.png',
    'https://cdn.example/output.png',
    'https://cdn.example/uri.png',
    'https://cdn.example/img.webp',
    'https://cdn.example/video.mp4',
    'https://cdn.example/audio.mp3',
    'https://cdn.example/nested.png',
  ]);
});

test('safeProviderPayload removes secrets, bounds size, and survives cyclic data', () => {
  const cyclic = { ok: true, api_key: 'secret', apiSecret: 'secret', Authorization: 'Bearer x' };
  cyclic.self = cyclic;
  const safe = safeProviderPayload(cyclic);
  assert.equal(safe.api_key, '[redacted]');
  assert.equal(safe.apiSecret, '[redacted]');
  assert.equal(safe.Authorization, '[redacted]');
  assert.equal(safe.self, '[circular]');

  const big = safeProviderPayload({ blob: 'x'.repeat(9000), token: 'secret' });
  assert.equal(big.truncated, true);
  assert.ok(big.bytes > 8000);
});

test('capability contract normalizes without claiming provider coverage', () => {
  assert.deepEqual(normalizeCapabilityList(['text-to-image', 'lip-sync', 'text-to-image']), [
    'lip-sync',
    'text-to-image',
  ]);
});

test('MuAPI adapter conforms to provider contract and preserves submit/retrieve normalization', async () => {
  const calls = [];
  const provider = new MuAPIProvider({
    apiHost: 'https://api.muapi.ai',
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init?.method || 'GET' });
      if (String(url).includes('/predictions/')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ status: 'completed', output: { url: 'https://cdn.example/r.png' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ request_id: 'req_123', api_key: 'redact' }),
      };
    },
  });
  validateGenerationProvider(provider);
  assert.equal(provider.features.cancel, false);
  const submitted = await provider.submit({ apiKey: 'k', endpoint: 'flux', payload: { prompt: 'hi' } });
  assert.equal(submitted.provider, PROVIDER_MUAPI);
  assert.equal(submitted.providerJobId, 'req_123');
  assert.equal(submitted.raw.api_key, '[redacted]');
  const retrieved = await provider.retrieve({ apiKey: 'k', providerJobId: 'req_123' });
  assert.equal(retrieved.status, 'succeeded');
  assert.equal(retrieved.primaryUrl, 'https://cdn.example/r.png');
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'GET']);
  assert.deepEqual(await provider.cancel(), { supported: false, cancelled: false });
});

test('MuAPI adapter preserves legacy error codes with canonical classification', async () => {
  const provider = new MuAPIProvider({
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'unauthorized', apiKey: 'secret' }),
    }),
  });
  await assert.rejects(
    () => provider.submit({ apiKey: 'k', endpoint: 'x', payload: {} }),
    (err) => {
      assert.equal(err.code, 'MUAPI_SUBMIT_FAILED');
      assert.equal(err.dynaxisProviderCode, 'PROVIDER_AUTH_FAILED');
      assert.equal(err.providerPayload.apiKey, '[redacted]');
      return true;
    }
  );
});

test('generation gateway resolves providers through injected registry and sanitizes canonical request/result', async () => {
  const registry = createProviderRegistry([makeProvider('gateway-provider')]);
  const gateway = createGenerationGateway({ providerRegistry: registry });
  const prepared = gateway.prepareRequest({
    provider: 'gateway-provider',
    capability: 'text-to-image',
    endpoint: 'generate',
    parameters: { prompt: 'hello', apiKey: 'SECRET' },
    metadata: { token: 'SECRET', ok: true },
  });
  assert.equal(prepared.provider.providerId, 'gateway-provider');
  assert.equal(prepared.request.provider, 'gateway-provider');
  assert.equal(prepared.request.parameters.apiKey, '[redacted]');
  assert.equal(prepared.request.metadata.token, '[redacted]');

  const submitted = await gateway.submit(prepared.request, {});
  assert.equal(submitted.provider, 'gateway-provider');
  assert.equal(submitted.providerJobId, 'job_1');
  assert.equal(submitted.raw.apiKey, '[redacted]');

  assert.throws(
    () => gateway.prepareRequest({ provider: 'unknown-provider', endpoint: 'x' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_NOT_FOUND');
      return true;
    }
  );
});

test('generation gateway defaults provider to MuAPI for compatibility', () => {
  const registry = createProviderRegistry([makeProvider(PROVIDER_MUAPI)]);
  const gateway = createGenerationGateway({ providerRegistry: registry });
  const { request } = gateway.prepareRequest({ endpoint: 'flux', parameters: { prompt: 'hi' } });
  assert.equal(request.provider, PROVIDER_MUAPI);
});

test('normaliseProviderStatus compatibility export remains available', () => {
  assert.equal(normaliseProviderStatus('completed'), 'succeeded');
  assert.equal(normaliseProviderStatus('weird'), 'unknown');
});
