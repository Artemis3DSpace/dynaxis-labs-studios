import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJobEvent, JOB_EVENT_NAMES, normalizeIdempotencyKey } from '../lib/dynaxis/jobs/index.js';

test('event payload redaction removes secret-bearing fields', () => {
  const event = createJobEvent({
    name: JOB_EVENT_NAMES.FAILED,
    jobId: 'job-123',
    payload: {
      error: 'upstream denied',
      apiKey: 'raw-api-key',
      nested: {
        secretRef: 'secret-ref',
        encryptedPayload: 'ciphertext',
        safeField: 'safe',
      },
    },
  });

  assert.equal(event.payload.apiKey, '[REDACTED]');
  assert.equal(event.payload.nested.secretRef, '[REDACTED]');
  assert.equal(event.payload.nested.encryptedPayload, '[REDACTED]');
  assert.equal(event.payload.nested.safeField, 'safe');
});

test('idempotency key normalization is stable and bounded', () => {
  assert.equal(
    normalizeIdempotencyKey('  Request::Create Generation   #42  '),
    'request::create-generation-#42'
  );
  assert.throws(() => normalizeIdempotencyKey('   '), /must not be empty/);
});

test('job event enforces safe event payload and correlation id shape', () => {
  const event = createJobEvent({
    name: JOB_EVENT_NAMES.DISPATCHED,
    jobId: 'job-456',
    payload: { attempt: 1, token: 'secret' },
    correlation: {
      requestId: 'req-1',
      generationId: 'gen-1',
      providerJobId: 'provider-job-abc',
    },
    idempotencyKey: '  dispatch:job-456 ',
  });

  assert.equal(event.payload.token, '[REDACTED]');
  assert.deepEqual(event.correlation, {
    requestId: 'req-1',
    generationId: 'gen-1',
    providerJobId: 'provider-job-abc',
  });
  assert.equal(event.idempotencyKey, 'dispatch:job-456');
});

test('jobs scaffold files do not import provider-connections or secrets modules', async () => {
  const files = [
    '../lib/dynaxis/jobs/contracts.js',
    '../lib/dynaxis/jobs/errors.js',
    '../lib/dynaxis/jobs/events.js',
    '../lib/dynaxis/jobs/idempotency.js',
    '../lib/dynaxis/jobs/index.js',
    '../lib/dynaxis/jobs/state-machine.js',
  ];
  const source = (
    await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')))
  ).join('\n');

  assert.doesNotMatch(source, /lib\/dynaxis\/provider-connections/);
  assert.doesNotMatch(source, /lib\/dynaxis\/secrets/);
  assert.doesNotMatch(source, /app\/api\/dynaxis\/provider-connections/);
});

