import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
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
  parseGenerationGatewayResult,
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

test('provider registration rejects noncanonical ids and malformed descriptors', () => {
  for (const providerId of [' MuAPI ', 'MUAPI', 'bad provider']) {
    assert.throws(
      () => validateGenerationProvider(makeProvider(providerId)),
      (err) => {
        assert.equal(err.code, 'PROVIDER_REGISTRATION_INVALID');
        assert.match(err.message, /canonical providerId/);
        return true;
      }
    );
  }
  assert.equal(validateGenerationProvider(makeProvider(PROVIDER_MUAPI)).providerId, PROVIDER_MUAPI);

  assert.throws(
    () => validateGenerationProvider(makeProvider('bad-features', { features: { cancel: 'yes' } })),
    (err) => {
      assert.equal(err.code, 'PROVIDER_REGISTRATION_INVALID');
      assert.equal(err.providerId, 'bad-features');
      assert.doesNotMatch(err.message, /Zod|invalid_type|SHOULD_NOT_LEAK/);
      return true;
    }
  );

  assert.throws(
    () => validateGenerationProvider(makeProvider('bad-descriptor', { metadata: { displayName: '' } })),
    (err) => {
      assert.equal(err.code, 'PROVIDER_REGISTRATION_INVALID');
      assert.equal(err.providerId, 'bad-descriptor');
      assert.doesNotMatch(err.message, /Zod|too_small|SHOULD_NOT_LEAK/);
      return true;
    }
  );

  const validExtensibleProvider = validateGenerationProvider(
    makeProvider('valid-capabilities', {
      capabilities: ['text-to-image', 'lip-sync', 'custom-generation-capability'],
    })
  );
  assert.equal(validExtensibleProvider.providerId, 'valid-capabilities');

  for (const capability of ['Text To Image', ' bad capability ', 'bad capability', '!']) {
    assert.throws(
      () => validateGenerationProvider(makeProvider('bad-capability', { capabilities: [capability] })),
      (err) => {
        assert.equal(err.code, 'PROVIDER_REGISTRATION_INVALID');
        assert.equal(err.providerId, 'bad-capability');
        assert.doesNotMatch(err.message, /Zod|custom|SHOULD_NOT_LEAK/);
        return true;
      }
    );
  }
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

  registry.replace(makeProvider('z-provider', { capabilities: ['custom-generation-capability'] }));
  assert.deepEqual(registry.list().find((p) => p.providerId === 'z-provider')?.capabilities, [
    'custom-generation-capability',
  ]);
  registry.require('z-provider').capabilities = ['bad capability'];
  assert.throws(
    () => registry.list(),
    (err) => {
      assert.equal(err.code, 'PROVIDER_REGISTRATION_INVALID');
      assert.equal(err.providerId, 'z-provider');
      return true;
    }
  );
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
  const cyclic = {
    ok: true,
    api_key: 'secret',
    apiSecret: 'secret',
    Authorization: 'Bearer x',
    nested: {
      'x-api-key': 'secret',
      x_api_key: 'secret',
      client_secret: 'secret',
      clientSecret: 'secret',
      password: 'secret',
      secret: 'secret',
    },
  };
  cyclic.self = cyclic;
  const safe = safeProviderPayload(cyclic);
  assert.equal(safe.api_key, '[redacted]');
  assert.equal(safe.apiSecret, '[redacted]');
  assert.equal(safe.Authorization, '[redacted]');
  assert.equal(safe.nested['x-api-key'], '[redacted]');
  assert.equal(safe.nested.x_api_key, '[redacted]');
  assert.equal(safe.nested.client_secret, '[redacted]');
  assert.equal(safe.nested.clientSecret, '[redacted]');
  assert.equal(safe.nested.password, '[redacted]');
  assert.equal(safe.nested.secret, '[redacted]');
  assert.equal(safe.self, '[circular]');

  const big = safeProviderPayload({ blob: 'x'.repeat(9000), token: 'secret' });
  assert.equal(big.truncated, true);
  assert.ok(big.bytes > 8000);

  const nonAscii = safeProviderPayload({ blob: 'é'.repeat(4100) });
  assert.equal(nonAscii.truncated, true);
  assert.ok(nonAscii.bytes > 8200);
});

test('safeProviderPayload redacts camelCase and snake_case OAuth tokens', () => {
  const safe = safeProviderPayload({
    accessToken: 'SECRET_ACCESS_CAMEL',
    refreshToken: 'SECRET_REFRESH_CAMEL',
    access_token: 'SECRET_ACCESS_SNAKE',
    refresh_token: 'SECRET_REFRESH_SNAKE',
  });

  assert.equal(safe.accessToken, '[redacted]');
  assert.equal(safe.refreshToken, '[redacted]');
  assert.equal(safe.access_token, '[redacted]');
  assert.equal(safe.refresh_token, '[redacted]');
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

test('MuAPI retrieve treats HTTP 429 as retryable rate limiting', async () => {
  const provider = new MuAPIProvider({
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: 'rate limited', apiKey: 'secret' }),
    }),
  });
  await assert.rejects(
    () => provider.retrieve({ apiKey: 'k', providerJobId: 'req_123' }),
    (err) => {
      assert.equal(err.code, 'MUAPI_POLL_FAILED');
      assert.equal(err.dynaxisProviderCode, 'PROVIDER_RATE_LIMITED');
      assert.equal(err.retryable, true);
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

test('generation gateway validates capabilities without silently dropping invalid values', () => {
  const registry = createProviderRegistry([makeProvider(PROVIDER_MUAPI)]);
  const gateway = createGenerationGateway({ providerRegistry: registry });
  assert.equal(gateway.prepareRequest({ endpoint: 'flux' }).request.capability, null);
  assert.equal(
    gateway.prepareRequest({ endpoint: 'flux', capability: ' Text-To-Image ' }).request.capability,
    'text-to-image'
  );
  assert.throws(
    () => gateway.prepareRequest({ endpoint: 'flux', capability: 'not real' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.validate');
      return true;
    }
  );
});

test('generation gateway enforces provider result identity', async () => {
  const registry = createProviderRegistry([
    makeProvider('identity-provider', {
      submit: async () => ({
        provider: 'identity-provider',
        providerJobId: 'job_2',
        outputs: ['https://cdn.example/match.png'],
      }),
      retrieve: async () => ({
        providerJobId: 'job_2',
        outputs: ['https://cdn.example/inherited.png'],
      }),
    }),
  ]);
  const gateway = createGenerationGateway({ providerRegistry: registry });
  const submitted = await gateway.submit({ provider: 'identity-provider', endpoint: 'x' });
  assert.equal(submitted.provider, 'identity-provider');
  assert.equal(submitted.primaryUrl, 'https://cdn.example/match.png');

  const retrieved = await gateway.retrieve({
    provider: 'identity-provider',
    providerJobId: 'job_2',
  });
  assert.equal(retrieved.provider, 'identity-provider');
  assert.equal(retrieved.primaryUrl, 'https://cdn.example/inherited.png');

  await assert.rejects(
    () =>
      createGenerationGateway({
        providerRegistry: createProviderRegistry([
          makeProvider('identity-provider', {
            submit: async () => ({ provider: PROVIDER_MUAPI, providerJobId: 'bad' }),
          }),
        ]),
      }).submit({ provider: 'identity-provider', endpoint: 'x' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.result');
      assert.equal(err.providerId, 'identity-provider');
      return true;
    }
  );

  assert.throws(
    () => parseGenerationGatewayResult({ providerJobId: 'job_without_provider' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.result');
      return true;
    }
  );
});

test('generation gateway wraps adapter failures with canonical provider errors', async () => {
  const muapi = new MuAPIProvider({
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'unauthorized', apiKey: 'SUPER_SECRET_VALUE' }),
    }),
  });
  const gateway = createGenerationGateway({
    providerRegistry: createProviderRegistry([muapi]),
  });
  await assert.rejects(
    () => gateway.submit({ provider: PROVIDER_MUAPI, endpoint: 'x' }, { apiKey: 'k' }),
    (err) => {
      assert.equal(err.name, 'DynaxisProviderError');
      assert.equal(err.code, 'PROVIDER_AUTH_FAILED');
      assert.equal(err.message, 'Provider authentication failed');
      assert.doesNotMatch(err.message, /SUPER_SECRET_VALUE/);
      assert.doesNotMatch(err.message, /apiKey|unauthorized/);
      assert.equal(err.legacyCode, 'MUAPI_SUBMIT_FAILED');
      assert.equal(err.providerId, PROVIDER_MUAPI);
      assert.equal(err.operation, 'submit');
      assert.equal(err.status, 401);
      assert.equal(err.providerPayload.apiKey, '[redacted]');
      assert.equal(err.cause, undefined);
      return true;
    }
  );

  const genericGateway = createGenerationGateway({
    providerRegistry: createProviderRegistry([
      makeProvider('failing-provider', {
        submit: async () => {
          const err = new Error('generic failure apiKey=FAKE_CREDENTIAL');
          err.status = 503;
          err.providerPayload = { client_secret: 'FAKE_CREDENTIAL' };
          throw err;
        },
      }),
    ]),
  });
  await assert.rejects(
    () => genericGateway.submit({ provider: 'failing-provider', endpoint: 'x' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_SUBMIT_FAILED');
      assert.equal(err.message, 'Provider submit failed');
      assert.doesNotMatch(err.message, /FAKE_CREDENTIAL|apiKey/);
      assert.equal(err.providerId, 'failing-provider');
      assert.equal(err.operation, 'submit');
      assert.equal(err.status, 503);
      assert.equal(err.retryable, true);
      assert.equal(err.providerPayload.client_secret, '[redacted]');
      assert.equal(err.cause, undefined);
      assert.doesNotMatch(JSON.stringify(err), /FAKE_CREDENTIAL|client_secret=FAKE_CREDENTIAL/);
      assert.doesNotMatch(inspect(err, { showHidden: true }), /FAKE_CREDENTIAL/);
      assert.doesNotMatch(
        inspect(Reflect.ownKeys(err).map((key) => [key, err[key]]), { showHidden: true }),
        /FAKE_CREDENTIAL/
      );
      return true;
    }
  );
});

test('generation gateway validates provider job operations before provider resolution', async () => {
  const gateway = createGenerationGateway({
    providerRegistry: createProviderRegistry([
      makeProvider('retrieve-provider', {
        retrieve: async () => ({
          provider: 'retrieve-provider',
          providerJobId: 'job_1',
          outputs: ['https://cdn.example/retrieve.png'],
        }),
      }),
    ]),
  });
  await assert.rejects(
    () => gateway.retrieve({ provider: 'retrieve-provider', providerJobId: '' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.retrieve');
      return true;
    }
  );
  await assert.rejects(
    () => gateway.cancel({ provider: 'retrieve-provider', providerJobId: '' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.cancel');
      return true;
    }
  );
  await assert.rejects(
    () => gateway.retrieve({ provider: 'bad provider', providerJobId: 'job_1' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_INVALID_REQUEST');
      assert.equal(err.operation, 'gateway.retrieve');
      return true;
    }
  );
  const result = await gateway.retrieve({ provider: 'retrieve-provider', providerJobId: 'job_1' });
  assert.equal(result.provider, 'retrieve-provider');
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

test('generation route helpers distinguish legacy compatibility from canonical auth', async () => {
  const { isLegacyRouteCompatibility, legacyOwnerRefFromRoute } = await import(
    '../lib/dynaxis/services/generations.js'
  );
  const ownerRef = 'ak_sha256:test-legacy-owner';
  const legacyContext = {
    legacyCompatibility: { used: true, ownerRef },
    authContext: { subject: { type: 'legacy' } },
  };
  const canonicalContext = {
    legacyCompatibility: { used: false },
    authContext: {
      subject: { type: 'user', userId: 'user-1' },
      workspace: { organizationId: 'org-1', isMember: true },
    },
  };

  assert.equal(isLegacyRouteCompatibility(legacyContext), true);
  assert.equal(isLegacyRouteCompatibility(canonicalContext), false);
  assert.equal(legacyOwnerRefFromRoute(legacyContext), ownerRef);
  assert.equal(legacyOwnerRefFromRoute(canonicalContext), null);
});

test('lifecycle route flow registers trusted ownership for in-flight generation and job pairs', async () => {
  const { ownerRefFromApiKey } = await import('../lib/dynaxis/ownership.js');
  const {
    findTrustedGenerationOwnership,
    clearTrustedGenerationOwnership,
  } = await import('../lib/dynaxis/services/generations.js');
  const { findTrustedJobOwnership, clearTrustedJobOwnership } = await import(
    '../lib/dynaxis/services/jobs.js'
  );
  const { startLifecycle, attachProviderJobIdForRoute, completeLifecycleForRoute } = await import(
    '../lib/dynaxis/services/lifecycle.js'
  );

  const ownerRef = ownerRefFromApiKey('provider-kernel-lifecycle-key');
  const routeContext = {
    legacyCompatibility: { used: true, ownerRef },
    authContext: { subject: { type: 'legacy' } },
  };

  const started = await startLifecycle(ownerRef, {
    endpoint: 'flux',
    prompt: 'route migration regression',
  });
  assert.ok(started.generation?.id);
  assert.ok(started.job?.id);

  const generationOwnership = await findTrustedGenerationOwnership(started.generation.id);
  const jobOwnership = await findTrustedJobOwnership(started.job.id);
  assert.equal(generationOwnership?.projectId, started.project.id);
  assert.equal(jobOwnership?.projectId, started.project.id);

  await attachProviderJobIdForRoute(routeContext, {
    generationId: started.generation.id,
    jobId: started.job.id,
    providerJobId: 'provider_job_route_1',
  });

  const done = await completeLifecycleForRoute(routeContext, {
    generationId: started.generation.id,
    jobId: started.job.id,
    urls: ['https://cdn.example/route-migration.png'],
  });
  assert.equal(done.generation.status, 'succeeded');
  assert.equal(done.job.status, 'succeeded');
  assert.equal(done.assets.length, 1);

  clearTrustedGenerationOwnership(started.generation.id);
  clearTrustedJobOwnership(started.job.id);
});

test('lifecycle route helpers reject stale job and missing generation pairs', async () => {
  const { ownerRefFromApiKey } = await import('../lib/dynaxis/ownership.js');
  const { startLifecycle, attachProviderJobIdForRoute } = await import(
    '../lib/dynaxis/services/lifecycle.js'
  );

  const ownerRef = ownerRefFromApiKey('provider-kernel-stale-job-key');
  const routeContext = {
    legacyCompatibility: { used: true, ownerRef },
    authContext: { subject: { type: 'legacy' } },
  };
  const a = await startLifecycle(ownerRef, { endpoint: 'a' });
  const b = await startLifecycle(ownerRef, { endpoint: 'b' });

  await assert.rejects(
    () =>
      attachProviderJobIdForRoute(routeContext, {
        generationId: a.generation.id,
        jobId: b.job.id,
        providerJobId: 'stale',
      }),
    (err) => {
      assert.equal(err.code, 'JOB_GENERATION_MISMATCH');
      return true;
    }
  );

  await assert.rejects(
    () =>
      attachProviderJobIdForRoute(routeContext, {
        generationId: '11111111-1111-4111-8111-111111111111',
        jobId: '22222222-2222-4222-8222-222222222222',
        providerJobId: 'missing',
      }),
    (err) => {
      assert.equal(err.code, 'GENERATION_JOB_NOT_FOUND');
      return true;
    }
  );
});

test('canonical generation mutations are denied until persistence bridge exists', async () => {
  const { createGenerationForRoute } = await import('../lib/dynaxis/services/generations.js');
  const { AuthContextError } = await import('../lib/dynaxis/auth/auth-context.js');

  const routeContext = {
    legacyCompatibility: { used: false },
    authContext: {
      subject: { type: 'user', userId: '11111111-1111-4111-8111-111111111111' },
      workspace: {
        organizationId: '33333333-3333-4333-8333-333333333333',
        isMember: true,
      },
    },
  };

  await assert.rejects(
    () =>
      createGenerationForRoute(routeContext, {
        projectId: '44444444-4444-4444-8444-444444444444',
        prompt: 'blocked canonical create',
      }),
    (err) => {
      assert.ok(err instanceof AuthContextError);
      assert.match(err.message, /persistence bridge/);
      return true;
    }
  );
});
