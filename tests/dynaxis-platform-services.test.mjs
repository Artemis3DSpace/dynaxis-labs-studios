import test from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { PROVIDER_MUAPI } from '../lib/dynaxis/types.js';
import {
  ensureDefaultProject,
  createProject,
  getProject,
  updateProject,
  listProjects,
  archiveProject,
} from '../lib/dynaxis/services/projects.js';
import { registerAsset, listAssets, listAssetsForGeneration } from '../lib/dynaxis/services/assets.js';
import { createGeneration, getGeneration, listGenerations } from '../lib/dynaxis/services/generations.js';
import {
  startLifecycle,
  attachProviderJobId,
  completeLifecycle,
  failLifecycle,
} from '../lib/dynaxis/services/lifecycle.js';
import { importLocalHistory } from '../lib/dynaxis/services/history-compat.js';
import { createJob, getJob } from '../lib/dynaxis/services/jobs.js';

process.env.NODE_ENV = 'test';
process.env.DYNAXIS_PLATFORM_DRIVER = 'memory';
process.env.DYNAXIS_ALLOW_MEMORY_STORE = '1';

const OWNER = ownerRefFromApiKey('test-api-key-phase3');

test.beforeEach(() => {
  resetMemoryStore();
});

test('projects: ensureDefault, create, update, archive, ownership boundary', async () => {
  const def = await ensureDefaultProject(OWNER);
  assert.equal(def.isDefault, true);
  assert.equal(def.name, 'Default Project');
  const again = await ensureDefaultProject(OWNER);
  assert.equal(again.id, def.id);

  const created = await createProject(OWNER, { name: 'Campaign A', description: 'ads' });
  assert.equal(created.name, 'Campaign A');
  assert.equal(created.isDefault, false);

  const updated = await updateProject(OWNER, created.id, { name: 'Campaign B' });
  assert.equal(updated.name, 'Campaign B');

  const otherOwner = ownerRefFromApiKey('someone-else');
  const leaked = await getProject(otherOwner, created.id);
  assert.equal(leaked, null);

  await archiveProject(OWNER, created.id);
  const listed = await listProjects(OWNER);
  assert.equal(listed.some((p) => p.id === created.id), false);
  const withArchived = await listProjects(OWNER, { includeArchived: true });
  assert.equal(withArchived.some((p) => p.id === created.id && p.status === 'archived'), true);
});

test('lifecycle: success creates generation, job, and multi-assets', async () => {
  const started = await startLifecycle(OWNER, {
    featureId: 'image-studio',
    model: 'flux',
    prompt: 'a cat',
    endpoint: 'flux',
    assetHint: 'image',
  });
  assert.ok(started.generation.id);
  assert.ok(started.job.id);
  assert.equal(started.generation.status, 'submitted');
  assert.equal(started.generation.provider, PROVIDER_MUAPI);
  assert.equal(started.job.provider, PROVIDER_MUAPI);

  await attachProviderJobId(OWNER, {
    generationId: started.generation.id,
    jobId: started.job.id,
    providerJobId: 'pred_abc',
  });

  const done = await completeLifecycle(OWNER, {
    generationId: started.generation.id,
    jobId: started.job.id,
    urls: ['https://cdn.example/1.png', 'https://cdn.example/2.png'],
    result: { status: 'completed' },
  });
  assert.equal(done.generation.status, 'succeeded');
  assert.equal(done.job.status, 'succeeded');
  assert.equal(done.assets.length, 2);
  assert.equal(done.assets[0].provider, PROVIDER_MUAPI);

  const linked = await listAssetsForGeneration(started.generation.id);
  assert.equal(linked.length, 2);

  const assets = await listAssets(OWNER, { projectId: started.project.id });
  assert.equal(assets.length, 2);

  const history = await listGenerations(OWNER, { projectId: started.project.id });
  assert.equal(history.length, 1);
  assert.equal(history[0].status, 'succeeded');

  const job = await getJob(OWNER, started.job.id);
  assert.equal(job.providerJobId, 'pred_abc');
  assert.ok(job.completedAt);
});

test('lifecycle: explicit MuAPI provider persists on generation, job, and assets', async () => {
  const started = await startLifecycle(OWNER, {
    provider: PROVIDER_MUAPI,
    featureId: 'image-studio',
    model: 'flux',
    prompt: 'a dog',
    endpoint: 'flux',
    assetHint: 'image',
  });
  assert.equal(started.generation.provider, PROVIDER_MUAPI);
  assert.equal(started.job.provider, PROVIDER_MUAPI);
  const done = await completeLifecycle(OWNER, {
    generationId: started.generation.id,
    jobId: started.job.id,
    result: { status: 'completed', outputs: ['https://cdn.example/dog.png'] },
  });
  assert.equal(done.assets[0].provider, PROVIDER_MUAPI);
});

test('lifecycle: unregistered future provider is rejected deterministically', async () => {
  await assert.rejects(
    () => startLifecycle(OWNER, { provider: 'higgsfield', endpoint: 'x' }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_NOT_FOUND');
      assert.equal(err.providerId, 'higgsfield');
      return true;
    }
  );
});

test('lifecycle: rejects job from another generation', async () => {
  const a = await startLifecycle(OWNER, { endpoint: 'a' });
  const b = await startLifecycle(OWNER, { endpoint: 'b' });
  await assert.rejects(
    () =>
      completeLifecycle(OWNER, {
        generationId: a.generation.id,
        jobId: b.job.id,
        urls: ['https://cdn.example/bad.png'],
      }),
    (err) => {
      assert.equal(err.code, 'JOB_GENERATION_MISMATCH');
      return true;
    }
  );
});

test('lifecycle: rejects mismatched provider pair', async () => {
  const project = await ensureDefaultProject(OWNER);
  const generation = await createGeneration(OWNER, {
    projectId: project.id,
    provider: 'custom-provider',
    status: 'submitted',
  });
  const job = await createJob(OWNER, {
    projectId: project.id,
    generationId: generation.id,
    provider: PROVIDER_MUAPI,
  });
  await assert.rejects(
    () =>
      failLifecycle(OWNER, {
        generationId: generation.id,
        jobId: job.id,
        errorMessage: 'provider mismatch',
      }),
    (err) => {
      assert.equal(err.code, 'JOB_PROVIDER_MISMATCH');
      return true;
    }
  );
});

test('lifecycle: rejects mismatched project pair', async () => {
  const projectA = await createProject(OWNER, { name: 'A' });
  const projectB = await createProject(OWNER, { name: 'B' });
  const generation = await createGeneration(OWNER, {
    projectId: projectA.id,
    provider: PROVIDER_MUAPI,
    status: 'submitted',
  });
  const job = await createJob(OWNER, {
    projectId: projectB.id,
    generationId: generation.id,
    provider: PROVIDER_MUAPI,
  });
  await assert.rejects(
    () =>
      attachProviderJobId(OWNER, {
        generationId: generation.id,
        jobId: job.id,
        providerJobId: 'bad',
      }),
    (err) => {
      assert.equal(err.code, 'JOB_PROJECT_MISMATCH');
      return true;
    }
  );
});

test('lifecycle: failure persists error without assets', async () => {
  const started = await startLifecycle(OWNER, {
    featureId: 'video-studio',
    model: 'kling',
    prompt: 'wave',
  });
  const failed = await failLifecycle(OWNER, {
    generationId: started.generation.id,
    jobId: started.job.id,
    errorCode: 'MUAPI_ERROR',
    errorMessage: 'Generation failed: boom',
  });
  assert.equal(failed.generation.status, 'failed');
  assert.equal(failed.job.status, 'failed');
  assert.ok(failed.job.failedAt);
  assert.match(failed.job.errorMessage, /boom/);
  const generation = await getGeneration(OWNER, started.generation.id);
  assert.equal(generation.errorMessage, 'Generation failed: boom');
  const assets = await listAssets(OWNER, { generationId: started.generation.id });
  assert.equal(assets.length, 0);
});

test('assets: register associates project and generation', async () => {
  const project = await ensureDefaultProject(OWNER);
  const started = await startLifecycle(OWNER, {
    projectId: project.id,
    featureId: 'audio-studio',
    prompt: 'lofi',
  });
  const asset = await registerAsset(OWNER, {
    projectId: project.id,
    generationId: started.generation.id,
    jobId: started.job.id,
    url: 'https://cdn.example/track.mp3',
    type: 'audio',
    source: 'generated',
    provider: 'muapi',
    model: 'audio-v1',
    prompt: 'lofi',
  });
  assert.equal(asset.projectId, project.id);
  assert.equal(asset.generationId, started.generation.id);
  assert.equal(asset.type, 'audio');
});

test('history import dedupes by migrationKey and does not invent duplicates', async () => {
  const entry = {
    studioKey: 'hg_image_studio_persistent',
    url: 'https://cdn.example/legacy.png',
    prompt: 'legacy',
    model: 'flux',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const first = await importLocalHistory(OWNER, { entries: [entry] });
  assert.equal(first.imported, 1);
  assert.equal(first.skipped, 0);
  const second = await importLocalHistory(OWNER, { entries: [entry] });
  assert.equal(second.imported, 0);
  assert.equal(second.skipped, 1);
  const gens = await listGenerations(OWNER);
  assert.equal(gens.length, 1);
  assert.equal(gens[0].status, 'succeeded');
});
