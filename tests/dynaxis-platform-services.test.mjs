import test from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { PROVIDER_MUAPI } from '../lib/dynaxis/types.js';
import {
  AUTH_CONTEXT_SUBJECT_TYPES,
  createAuthContextFromSubject,
  createLegacyAuthContext,
} from '../lib/dynaxis/auth/auth-context.js';
import { getPlatformStore } from '../lib/dynaxis/db/store.js';
import {
  ensureDefaultProject,
  createProject,
  getProject,
  updateProject,
  listProjects,
  archiveProject,
  createCanonicalProjectForAuthContext,
  ensureCanonicalDefaultProject,
  listCanonicalProjects,
  getCanonicalProjectForAuthContext,
  updateCanonicalProjectForAuthContext,
  listProjectsForRoute,
  createProjectForRoute,
  getProjectForRoute,
  updateProjectForRoute,
} from '../lib/dynaxis/services/projects.js';
import {
  registerAsset,
  listAssets,
  listAssetsForGeneration,
  registerCanonicalAsset,
  listCanonicalAssetsForAuthorizedProject,
  getCanonicalAssetForAuthContext,
  findTrustedAssetOwnership,
  listAssetsForRoute,
  registerAssetForRoute,
  getAssetForRoute,
} from '../lib/dynaxis/services/assets.js';
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
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222';

function canonicalAuthContext({
  userId = USER_A,
  organizationId = ORG_A,
  workspaceRole = 'admin',
} = {}) {
  return createAuthContextFromSubject({
    type: AUTH_CONTEXT_SUBJECT_TYPES.USER,
    userId,
    sessionId: 'session-7c14',
    workspace: {
      organizationId,
      role: workspaceRole,
      isMember: true,
      isPersonal: false,
    },
  });
}

function routeContextFor(authContext, legacy = null) {
  return {
    authContext,
    legacyCompatibility: legacy || {
      enabled: true,
      presented: false,
      used: false,
      source: 'x-api-key',
    },
  };
}

function legacyRouteContext(ownerRef = OWNER) {
  const authContext = createLegacyAuthContext({ legacyOwnerRef: ownerRef });
  return routeContextFor(authContext, {
    enabled: true,
    presented: true,
    used: true,
    source: 'x-api-key',
    mode: 'legacy-owner-ref-route',
    ownerRef,
  });
}

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

test('canonical projects: list is membership-scoped and create uses owner_ref NULL', async () => {
  const authA = canonicalAuthContext({ userId: USER_A, workspaceRole: 'admin' });
  const authB = canonicalAuthContext({ userId: USER_B, workspaceRole: 'admin' });

  const mine = await createCanonicalProjectForAuthContext(authA, { name: 'Mine' });
  assert.equal(mine.ownerRef, null);
  assert.equal(mine.organizationId, ORG_A);

  await createCanonicalProjectForAuthContext(authB, { name: 'Theirs' });

  const listed = await listCanonicalProjects(authA, { ensureDefault: false, includeArchived: true });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, mine.id);
  assert.equal(listed.every((project) => project.ownerRef === null), true);

  const fetched = await getCanonicalProjectForAuthContext(authA, mine.id);
  assert.equal(fetched.id, mine.id);
  const otherWorkspace = canonicalAuthContext({ userId: USER_B, organizationId: ORG_B });
  assert.equal(await getCanonicalProjectForAuthContext(otherWorkspace, mine.id), null);
});

test('canonical projects: default Project is membership-safe per user', async () => {
  const authA = canonicalAuthContext({ userId: USER_A, workspaceRole: 'admin' });
  const authB = canonicalAuthContext({ userId: USER_B, workspaceRole: 'admin' });

  const defaultA = await ensureCanonicalDefaultProject(authA);
  assert.equal(defaultA.isDefault, true);
  assert.equal(defaultA.ownerRef, null);
  assert.equal(defaultA.organizationId, ORG_A);

  const again = await ensureCanonicalDefaultProject(authA);
  assert.equal(again.id, defaultA.id);

  const defaultB = await ensureCanonicalDefaultProject(authB);
  assert.notEqual(defaultB.id, defaultA.id);
  assert.equal(defaultB.ownerRef, null);

  const listedA = await listCanonicalProjects(authA, { ensureDefault: false });
  assert.equal(listedA.some((project) => project.id === defaultA.id), true);
  assert.equal(listedA.some((project) => project.id === defaultB.id), false);
});

test('canonical projects: update requires same Workspace and archive works', async () => {
  const authA = canonicalAuthContext({ userId: USER_A });
  const created = await createCanonicalProjectForAuthContext(authA, { name: 'Editable' });
  const updated = await updateCanonicalProjectForAuthContext(authA, created.id, {
    name: 'Renamed',
  });
  assert.equal(updated.name, 'Renamed');

  const archived = await updateCanonicalProjectForAuthContext(authA, created.id, {
    status: 'archived',
  });
  assert.equal(archived.status, 'archived');

  const foreign = canonicalAuthContext({ userId: USER_A, organizationId: ORG_B });
  assert.equal(await updateCanonicalProjectForAuthContext(foreign, created.id, { name: 'Nope' }), null);
});

test('canonical assets: create/list/get under authorized Project with owner_ref NULL', async () => {
  const authA = canonicalAuthContext({ userId: USER_A });
  const project = await createCanonicalProjectForAuthContext(authA, { name: 'Asset Home' });
  const asset = await registerCanonicalAsset(
    authA,
    {
      projectId: project.id,
      url: 'https://cdn.example/canonical.png',
      type: 'image',
      source: 'generated',
    },
    { projectId: project.id }
  );
  assert.equal(asset.ownerRef, null);
  assert.equal(asset.projectId, project.id);

  const listed = await listCanonicalAssetsForAuthorizedProject(authA, { projectId: project.id });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, asset.id);

  const ownership = await findTrustedAssetOwnership(asset.id);
  assert.deepEqual(ownership, {
    type: 'asset',
    id: asset.id,
    projectId: project.id,
    organizationId: ORG_A,
  });

  const fetched = await getCanonicalAssetForAuthContext(authA, asset.id);
  assert.equal(fetched.id, asset.id);

  const foreign = canonicalAuthContext({ userId: USER_A, organizationId: ORG_B });
  assert.equal(await getCanonicalAssetForAuthContext(foreign, asset.id), null);
});

test('canonical assets: list requires Project scope and rejects foreign Project', async () => {
  const authA = canonicalAuthContext({ userId: USER_A });
  const project = await createCanonicalProjectForAuthContext(authA, { name: 'Scoped' });
  await registerCanonicalAsset(
    authA,
    { projectId: project.id, url: 'https://cdn.example/a.png', type: 'image' },
    { projectId: project.id }
  );

  await assert.rejects(
    () => listCanonicalAssetsForAuthorizedProject(authA, {}),
    (err) => err.status === 400 && err.code === 'VALIDATION_ERROR'
  );

  const foreign = canonicalAuthContext({ userId: USER_B, organizationId: ORG_B });
  await assert.rejects(
    () => listCanonicalAssetsForAuthorizedProject(foreign, { projectId: project.id }),
    (err) => err.status === 404
  );
});

test('route compatibility: legacy Project/Asset paths still work with ownerRef', async () => {
  const legacy = legacyRouteContext(OWNER);
  const project = await createProjectForRoute(legacy, { name: 'Legacy Route Project' });
  assert.equal(project.ownerRef, OWNER);

  const listed = await listProjectsForRoute(legacy, { ensureDefault: false });
  assert.equal(listed.some((row) => row.id === project.id), true);
  assert.equal((await getProjectForRoute(legacy, project.id)).id, project.id);

  const renamed = await updateProjectForRoute(legacy, project.id, { name: 'Legacy Renamed' });
  assert.equal(renamed.name, 'Legacy Renamed');

  const asset = await registerAssetForRoute(legacy, {
    projectId: project.id,
    url: 'https://cdn.example/legacy-route.png',
    type: 'image',
  });
  assert.equal(asset.ownerRef, OWNER);
  const assets = await listAssetsForRoute(legacy, { projectId: project.id });
  assert.equal(assets.some((row) => row.id === asset.id), true);
  assert.equal((await getAssetForRoute(legacy, asset.id)).id, asset.id);
});

test('route compatibility: canonical flow chooses AuthContext store APIs without inventing owner_ref', async () => {
  const auth = canonicalAuthContext({ userId: USER_A, workspaceRole: 'admin' });
  const ctx = routeContextFor(auth);
  const project = await createProjectForRoute(ctx, { name: 'Canonical Route Project' });
  assert.equal(project.ownerRef, null);
  assert.equal(project.organizationId, ORG_A);

  const listed = await listProjectsForRoute(ctx, { ensureDefault: false });
  assert.equal(listed.some((row) => row.id === project.id), true);

  const asset = await registerAssetForRoute(
    ctx,
    { projectId: project.id, url: 'https://cdn.example/route-canonical.png', type: 'image' },
    { projectId: project.id }
  );
  assert.equal(asset.ownerRef, null);
  assert.equal((await getAssetForRoute(ctx, asset.id)).id, asset.id);
});

test('regression: canonical AuthContext flow does not require x-api-key or owner_ref', async () => {
  const auth = canonicalAuthContext({ userId: USER_A, workspaceRole: 'admin' });
  assert.equal(auth.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.USER);
  assert.equal(auth.compatibility, null);
  assert.equal(auth.principal?.userId, USER_A);

  const ctx = routeContextFor(auth);
  assert.equal(ctx.legacyCompatibility.used, false);
  assert.equal(ctx.legacyCompatibility.presented, false);

  const project = await createProjectForRoute(ctx, { name: 'Session Only Project' });
  assert.equal(project.ownerRef, null);
  assert.equal(project.organizationId, ORG_A);

  const asset = await registerAssetForRoute(
    ctx,
    { projectId: project.id, url: 'https://cdn.example/session-only.png', type: 'image' },
    { projectId: project.id }
  );
  assert.equal(asset.ownerRef, null);

  const store = await getPlatformStore();
  assert.equal((await store.getCanonicalProject(project.id)).ownerRef, null);
  assert.equal((await store.getCanonicalAsset(asset.id)).ownerRef, null);
  // No invented owner_ref schemes.
  assert.equal(String(project.ownerRef || '').startsWith('workspace:'), false);
  assert.equal(String(project.ownerRef || '').startsWith('user:'), false);
});
