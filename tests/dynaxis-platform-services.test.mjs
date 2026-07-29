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
  ensureCanonicalDefaultProject,
  createCanonicalProjectForUser,
  listCanonicalProjectsForUser,
  getCanonicalProjectInWorkspace,
  updateCanonicalProjectInWorkspace,
  archiveCanonicalProjectInWorkspace,
} from '../lib/dynaxis/services/projects.js';
import {
  registerAsset,
  listAssets,
  listAssetsForGeneration,
  registerCanonicalAsset,
  listCanonicalAssetsForProject,
  assetOwnershipRepository,
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
import { AUTH_CONTEXT_SUBJECT_TYPES } from '../lib/dynaxis/auth/auth-context.js';
import { authorizeProjectPolicy } from '../lib/dynaxis/auth/project-policy.js';
import { authorizeResourceInheritance } from '../lib/dynaxis/auth/resource-policy.js';
import { authorizeDynaxis, ALLOW, INSUFFICIENT_PROJECT_ROLE, NOT_PROJECT_MEMBER, RESOURCE_SCOPE_MISMATCH } from '../lib/dynaxis/auth/policy.js';
import {
  PROJECT_MEMBERSHIP_ERROR_CODES,
  ProjectMembershipServiceError,
} from '../lib/dynaxis/identity/project-membership.js';

process.env.NODE_ENV = 'test';
process.env.DYNAXIS_PLATFORM_DRIVER = 'memory';
process.env.DYNAXIS_ALLOW_MEMORY_STORE = '1';

const OWNER = ownerRefFromApiKey('test-api-key-phase3');
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ORG_OTHER = '22222222-2222-4222-8222-222222222222';
const USER_OWNER = 'aaaaaaaa-1111-4111-8111-111111111111';
const USER_EDITOR = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_VIEWER = 'cccccccc-3333-4333-8333-333333333333';
const USER_FOREIGN = 'dddddddd-4444-4444-8444-444444444444';

function sessionPayload(userId = USER_OWNER) {
  return {
    session: {
      id: '22222222-2222-4222-8222-222222222222',
      userId,
      activeOrganizationId: ORG_ID,
    },
    user: { id: userId, email: 'user@example.test' },
  };
}

function workspace(role = 'owner') {
  return {
    organizationId: ORG_ID,
    role,
    isMember: true,
    isPersonal: false,
  };
}

function projectMembershipService(role, projectId) {
  return {
    async get(input) {
      if (input.organizationId !== ORG_ID) {
        return null;
      }
      return {
        projectId: input.projectId || projectId,
        organizationId: ORG_ID,
        userId: input.userId,
        role,
      };
    },
  };
}

function humanPrincipal(userId = USER_OWNER) {
  return {
    type: 'human',
    principalId: `user:${userId}`,
    userId,
    authMethod: 'session',
  };
}

function projectContext(projectId, role, isMember = true) {
  return {
    projectId,
    organizationId: ORG_ID,
    role,
    isMember,
  };
}

async function evaluateProjectPermission(permission, role, projectId, userId = USER_OWNER) {
  return authorizeProjectPolicy({
    permission,
    principal: humanPrincipal(userId),
    workspace: workspace('owner'),
    project: projectContext(projectId, role),
    projectMembershipService: projectMembershipService(role, projectId),
  });
}

async function evaluateAssetPermission(permission, role, assetId, projectId, userId = USER_OWNER) {
  return authorizeResourceInheritance({
    permission,
    principal: humanPrincipal(userId),
    workspace: workspace('owner'),
    project: projectContext(projectId, role),
    resourceId: assetId,
    resourceType: 'asset',
    resourceRepository: assetOwnershipRepository,
    projectMembershipService: projectMembershipService(role, projectId),
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

test('canonical projects: default, create, list, update, archive, and cross-workspace isolation', async () => {
  const def = await ensureCanonicalDefaultProject({ organizationId: ORG_ID, userId: USER_OWNER });
  assert.equal(def.isDefault, true);
  assert.equal(def.ownerRef, null);

  const again = await ensureCanonicalDefaultProject({ organizationId: ORG_ID, userId: USER_OWNER });
  assert.equal(again.id, def.id);

  const created = await createCanonicalProjectForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
    input: { name: 'Canonical Campaign', description: 'ads' },
  });
  assert.equal(created.organizationId, ORG_ID);
  assert.equal(created.isDefault, false);

  const updated = await updateCanonicalProjectInWorkspace({
    organizationId: ORG_ID,
    projectId: created.id,
    input: { name: 'Renamed Campaign' },
  });
  assert.equal(updated.name, 'Renamed Campaign');

  const listed = await listCanonicalProjectsForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
  });
  assert.equal(listed.some((p) => p.id === created.id), true);

  const foreignList = await listCanonicalProjectsForUser({
    organizationId: ORG_ID,
    userId: USER_FOREIGN,
  });
  assert.equal(foreignList.some((p) => p.id === created.id), false);

  assert.equal(
    await getCanonicalProjectInWorkspace({ organizationId: ORG_OTHER, projectId: created.id }),
    null
  );

  await archiveCanonicalProjectInWorkspace({ organizationId: ORG_ID, projectId: created.id });
  const active = await listCanonicalProjectsForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
  });
  assert.equal(active.some((p) => p.id === created.id), false);
});

test('canonical assets: register, list, and trusted ownership lookup', async () => {
  const project = await createCanonicalProjectForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
    input: { name: 'Asset Project' },
  });
  const asset = await registerCanonicalAsset(
    { organizationId: ORG_ID, userId: USER_OWNER, projectId: project.id },
    {
      projectId: project.id,
      url: 'https://cdn.example/canonical.png',
      type: 'image',
      source: 'generated',
    }
  );
  assert.equal(asset.ownerRef, null);
  assert.equal(asset.projectId, project.id);

  const listed = await listCanonicalAssetsForProject({ projectId: project.id });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, asset.id);

  const ownership = await assetOwnershipRepository.findResource({ type: 'asset', id: asset.id });
  assert.deepEqual(ownership, {
    type: 'asset',
    id: asset.id,
    projectId: project.id,
    organizationId: ORG_ID,
  });
});

test('project route authorization: owner/admin/editor/viewer and cross-workspace denial', async () => {
  const project = await createCanonicalProjectForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
    input: { name: 'Auth Project' },
  });

  for (const role of ['owner', 'admin', 'editor', 'viewer']) {
    const read = await evaluateProjectPermission('project.read', role, project.id);
    assert.equal(read.allowed, true, `read ${role}`);
  }

  for (const role of ['owner', 'admin', 'editor']) {
    const update = await evaluateProjectPermission('project.update', role, project.id);
    assert.equal(update.allowed, true, `update ${role}`);
  }

  const viewerUpdate = await evaluateProjectPermission(
    'project.update',
    'viewer',
    project.id,
    USER_VIEWER
  );
  assert.equal(viewerUpdate.allowed, false);
  assert.equal(viewerUpdate.reason, INSUFFICIENT_PROJECT_ROLE);

  for (const role of ['owner', 'admin']) {
    const archive = await evaluateProjectPermission('project.archive', role, project.id);
    assert.equal(archive.allowed, true, `archive ${role}`);
  }

  const editorArchive = await evaluateProjectPermission(
    'project.archive',
    'editor',
    project.id,
    USER_EDITOR
  );
  assert.equal(editorArchive.allowed, false);
  assert.equal(editorArchive.reason, INSUFFICIENT_PROJECT_ROLE);

  const foreignRead = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: humanPrincipal(USER_FOREIGN),
    workspace: workspace('owner'),
    project: projectContext(project.id, 'owner'),
    projectMembershipService: {
      async get() {
        return null;
      },
    },
  });
  assert.equal(foreignRead.allowed, false);
  assert.equal(foreignRead.reason, NOT_PROJECT_MEMBER);

  const missingProject = await authorizeProjectPolicy({
    permission: 'project.read',
    principal: humanPrincipal(USER_OWNER),
    workspace: workspace('owner'),
    project: projectContext('99999999-9999-4999-8999-999999999999', 'owner'),
    projectMembershipService: {
      async get() {
        throw new ProjectMembershipServiceError('Project not found', {
          code: PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND,
          status: 404,
        });
      },
    },
  });
  assert.equal(missingProject.allowed, false);
  assert.equal(missingProject.status, 404);
});

test('asset route authorization: owner/admin/editor/viewer and cross-workspace not-found', async () => {
  const project = await createCanonicalProjectForUser({
    organizationId: ORG_ID,
    userId: USER_OWNER,
    input: { name: 'Asset Auth Project' },
  });
  const asset = await registerCanonicalAsset(
    { organizationId: ORG_ID, userId: USER_OWNER, projectId: project.id },
    {
      projectId: project.id,
      url: 'https://cdn.example/auth.png',
      type: 'image',
    }
  );

  for (const role of ['owner', 'admin', 'editor', 'viewer']) {
    const read = await evaluateAssetPermission('asset.read', role, asset.id, project.id);
    assert.equal(read.allowed, true, `asset.read ${role}`);
  }

  for (const role of ['owner', 'admin', 'editor']) {
    const create = await evaluateProjectPermission('asset.create', role, project.id);
    assert.equal(create.allowed, true, `asset.create ${role}`);
  }

  const viewerCreate = await evaluateProjectPermission(
    'asset.create',
    'viewer',
    project.id,
    USER_VIEWER
  );
  assert.equal(viewerCreate.allowed, false);
  assert.equal(viewerCreate.reason, INSUFFICIENT_PROJECT_ROLE);

  const crossWorkspace = await authorizeResourceInheritance({
    permission: 'asset.read',
    principal: humanPrincipal(USER_OWNER),
    workspace: workspace('owner'),
    project: projectContext(project.id, 'owner'),
    resourceId: asset.id,
    resourceType: 'asset',
    resourceRepository: {
      async findResource() {
        return {
          type: 'asset',
          id: asset.id,
          projectId: '99999999-9999-4999-8999-999999999999',
          organizationId: ORG_OTHER,
        };
      },
    },
    projectMembershipService: projectMembershipService('owner', project.id),
  });
  assert.equal(crossWorkspace.allowed, false);
  assert.equal(crossWorkspace.reason, RESOURCE_SCOPE_MISMATCH);
  assert.equal(crossWorkspace.status, 404);
});

test('project create authorization requires workspace admin role', async () => {
  const allowed = authorizeDynaxis({
    permission: 'project.create',
    principal: humanPrincipal(USER_OWNER),
    workspace: workspace('admin'),
  });
  assert.equal(allowed.reason, ALLOW);

  const denied = authorizeDynaxis({
    permission: 'project.create',
    principal: humanPrincipal(USER_EDITOR),
    workspace: workspace('member'),
  });
  assert.equal(denied.allowed, false);
});

test('legacy compatibility preserves ownerRef audit metadata without raw key disclosure', async () => {
  const rawKey = 'MUAPI_PLATFORM_SERVICES_LEGACY';
  const { createLegacyAuthContextFromRequest } = await import('../lib/dynaxis/auth/auth-context.js');
  const request = new Request('https://dynaxis.test/api/dynaxis/projects', {
    headers: { 'x-api-key': rawKey },
  });
  const authContext = createLegacyAuthContextFromRequest(request);
  assert.equal(authContext.subject.type, AUTH_CONTEXT_SUBJECT_TYPES.LEGACY);
  assert.equal(authContext.compatibility.ownerRef, ownerRefFromApiKey(rawKey));
  assert.doesNotMatch(JSON.stringify(authContext), new RegExp(rawKey));
});
