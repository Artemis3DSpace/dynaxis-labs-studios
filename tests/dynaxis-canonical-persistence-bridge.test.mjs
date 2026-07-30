import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DYNAXIS_PLATFORM_DRIVER = 'memory';
process.env.DYNAXIS_ALLOW_MEMORY_STORE = '1';

const { resetMemoryStore } = await import('../lib/dynaxis/db/memory-store.js');
const { getPlatformStore } = await import('../lib/dynaxis/db/store.js');
const { ownerRefFromApiKey } = await import('../lib/dynaxis/ownership.js');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const LEGACY_OWNER = ownerRefFromApiKey('legacy-key-7c24');

test.beforeEach(() => {
  resetMemoryStore();
});

async function store() {
  return getPlatformStore();
}

// ============================ PROJECTS ============================

test('projects: canonical create persists organization ownership with owner_ref NULL', async () => {
  const s = await store();
  const { project } = await s.createCanonicalProject({
    organizationId: ORG_A,
    userId: USER_A,
    name: 'Canonical A',
  });
  assert.equal(project.organizationId, ORG_A);
  assert.equal(project.ownerRef, null);
  assert.equal(project.isDefault, false);
  const fetched = await s.getCanonicalProject(project.id);
  assert.equal(fetched.id, project.id);
  assert.equal(fetched.ownerRef, null);
});

test('projects: legacy owner_ref create still works unchanged', async () => {
  const s = await store();
  const legacy = await s.createProject({ ownerRef: LEGACY_OWNER, name: 'Legacy' });
  assert.equal(legacy.ownerRef, LEGACY_OWNER);
  assert.equal(legacy.organizationId, null);
  assert.equal((await s.getProject(LEGACY_OWNER, legacy.id)).id, legacy.id);
  const listed = await s.listProjects(LEGACY_OWNER);
  assert.equal(listed.some((p) => p.id === legacy.id), true);
});

test('projects: creator receives explicit Project owner membership', async () => {
  const s = await store();
  const { project, membership } = await s.createCanonicalProject({
    organizationId: ORG_A,
    userId: USER_A,
    name: 'Owned',
  });
  assert.equal(membership.projectId, project.id);
  assert.equal(membership.organizationId, ORG_A);
  assert.equal(membership.userId, USER_A);
  assert.equal(membership.role, 'owner');
});

test('projects: failed creator membership does not leave an orphan Project', async () => {
  const s = await store();
  await assert.rejects(
    () => s.createCanonicalProject({ organizationId: ORG_A, userId: '', name: 'Orphan?' }),
    (err) => err.code === 'REQUIRED_INPUT'
  );
  // No durable Project row may remain from the failed creation.
  const forUser = await s.listCanonicalProjectsForUser({
    organizationId: ORG_A,
    userId: USER_A,
    includeArchived: true,
  });
  assert.equal(forUser.length, 0);
});

test('projects: listing returns only explicit Project memberships', async () => {
  const s = await store();
  const { project: mine } = await s.createCanonicalProject({
    organizationId: ORG_A,
    userId: USER_A,
    name: 'Mine',
  });
  // Same Workspace, different creator — USER_A is not a member of it.
  await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_B, name: 'Not mine' });
  // Other Workspace entirely.
  await s.createCanonicalProject({ organizationId: ORG_B, userId: USER_A, name: 'Other workspace' });

  const forUserA = await s.listCanonicalProjectsForUser({ organizationId: ORG_A, userId: USER_A });
  assert.deepEqual(forUserA.map((p) => p.id), [mine.id]);
  assert.equal(forUserA.some((p) => p.name === 'Not mine'), false);
  assert.equal(forUserA.some((p) => p.name === 'Other workspace'), false);
});

test('projects: canonical Default Project resolution respects explicit membership', async () => {
  const s = await store();
  const { project: defaultA } = await s.createCanonicalProject({
    organizationId: ORG_A,
    userId: USER_A,
    name: 'Default Project',
    isDefault: true,
  });
  const resolved = await s.getCanonicalDefaultProjectForUser({ organizationId: ORG_A, userId: USER_A });
  assert.equal(resolved.id, defaultA.id);
  // USER_B shares the Workspace but is not a member of USER_A's Default Project.
  assert.equal(
    await s.getCanonicalDefaultProjectForUser({ organizationId: ORG_A, userId: USER_B }),
    null
  );
});

test('projects: canonical update is Workspace-scoped and rejects cross-Workspace writes', async () => {
  const s = await store();
  const { project } = await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_A, name: 'A' });
  const updated = await s.updateCanonicalProject(
    { projectId: project.id, organizationId: ORG_A },
    { name: 'A renamed' }
  );
  assert.equal(updated.name, 'A renamed');
  const cross = await s.updateCanonicalProject(
    { projectId: project.id, organizationId: ORG_B },
    { name: 'hijack' }
  );
  assert.equal(cross, null);
  assert.equal((await s.getCanonicalProject(project.id)).name, 'A renamed');
});

test('projects: canonical and legacy partitions stay isolated', async () => {
  const s = await store();
  const { project: canonical } = await s.createCanonicalProject({
    organizationId: ORG_A,
    userId: USER_A,
    name: 'Canonical',
  });
  const legacy = await s.createProject({ ownerRef: LEGACY_OWNER, name: 'Legacy' });
  // Legacy owner_ref listing never surfaces the canonical row.
  const legacyList = await s.listProjects(LEGACY_OWNER);
  assert.equal(legacyList.some((p) => p.id === canonical.id), false);
  // Membership-scoped canonical listing never surfaces the legacy row.
  const canonicalList = await s.listCanonicalProjectsForUser({ organizationId: ORG_A, userId: USER_A });
  assert.equal(canonicalList.some((p) => p.id === legacy.id), false);
});

// ============================ ASSETS ============================

test('assets: canonical create persists Project ownership with owner_ref NULL', async () => {
  const s = await store();
  const { project } = await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_A, name: 'A' });
  const asset = await s.createCanonicalAsset({
    projectId: project.id,
    type: 'image',
    provider: 'higgsfield',
    model: 'soul',
    url: 'https://cdn.example/a.png',
  });
  assert.equal(asset.ownerRef, null);
  assert.equal(asset.projectId, project.id);
  assert.equal((await s.getCanonicalAsset(asset.id)).id, asset.id);
});

test('assets: legacy owner_ref create still works unchanged', async () => {
  const s = await store();
  const legacyProject = await s.createProject({ ownerRef: LEGACY_OWNER, name: 'Legacy' });
  const legacyAsset = await s.createAsset({
    ownerRef: LEGACY_OWNER,
    projectId: legacyProject.id,
    type: 'image',
    url: 'https://cdn.example/l.png',
  });
  assert.equal(legacyAsset.ownerRef, LEGACY_OWNER);
  assert.equal((await s.getAsset(LEGACY_OWNER, legacyAsset.id)).id, legacyAsset.id);
});

test('assets: canonical listing is Project-scoped', async () => {
  const s = await store();
  const { project: projectA } = await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_A, name: 'A' });
  const { project: projectB } = await s.createCanonicalProject({ organizationId: ORG_B, userId: USER_B, name: 'B' });
  const a1 = await s.createCanonicalAsset({ projectId: projectA.id, type: 'image', url: 'https://cdn.example/a1.png' });
  await s.createCanonicalAsset({ projectId: projectB.id, type: 'image', url: 'https://cdn.example/b1.png' });

  const listed = await s.listCanonicalAssetsForProject({ projectId: projectA.id });
  assert.deepEqual(listed.map((a) => a.id), [a1.id]);
  assert.equal(listed.every((a) => a.projectId === projectA.id), true);
});

test('assets: trusted ownership lookup derives Workspace through the Project', async () => {
  const s = await store();
  const { project } = await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_A, name: 'A' });
  const asset = await s.createCanonicalAsset({ projectId: project.id, type: 'image', url: 'https://cdn.example/a.png' });

  const ownership = await s.findAssetOwnership(asset.id);
  assert.deepEqual(ownership, {
    type: 'asset',
    id: asset.id,
    projectId: project.id,
    organizationId: ORG_A,
  });
  // Missing Asset yields null, never a fabricated ownership record.
  assert.equal(await s.findAssetOwnership('33333333-3333-4333-8333-333333333333'), null);

  // A legacy Asset under an unprojected legacy Project resolves organizationId null.
  const legacyProject = await s.createProject({ ownerRef: LEGACY_OWNER, name: 'Legacy' });
  const legacyAsset = await s.createAsset({ ownerRef: LEGACY_OWNER, projectId: legacyProject.id, type: 'image', url: 'https://cdn.example/l.png' });
  assert.equal((await s.findAssetOwnership(legacyAsset.id)).organizationId, null);
});

test('assets: cross-Project ownership cannot be spoofed by caller input', async () => {
  const s = await store();
  const { project: projectA } = await s.createCanonicalProject({ organizationId: ORG_A, userId: USER_A, name: 'A' });
  const { project: projectB } = await s.createCanonicalProject({ organizationId: ORG_B, userId: USER_B, name: 'B' });
  const foreignAsset = await s.createCanonicalAsset({ projectId: projectB.id, type: 'image', url: 'https://cdn.example/b.png' });

  // The trusted lookup reports the true owning Project/Workspace regardless of
  // any projectId a caller might supply alongside the Asset id.
  const ownership = await s.findAssetOwnership(foreignAsset.id);
  assert.equal(ownership.projectId, projectB.id);
  assert.equal(ownership.organizationId, ORG_B);
  assert.notEqual(ownership.projectId, projectA.id);
  assert.notEqual(ownership.organizationId, ORG_A);
});
