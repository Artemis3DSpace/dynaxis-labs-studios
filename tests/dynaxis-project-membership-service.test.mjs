import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js';
import {
  PROJECT_MEMBERSHIP_ERROR_CODES,
  ProjectMembershipService,
  createDrizzleProjectMembershipRepository,
} from '../lib/dynaxis/identity/project-membership.js';
import { projectServiceImpl } from '../lib/dynaxis/services/projects.js';
import { user, organization, member } from '../lib/dynaxis/auth/schema.js';
import { dynaxisProjectMembers, dynaxisProjects } from '../lib/dynaxis/db/schema.js';
import { dynaxisOwnerRefClaims } from '../lib/dynaxis/identity/schema.js';

const ROOT = new URL('..', import.meta.url);

function expectCode(code) {
  return (err) => err?.code === code;
}

function makeMembership({ projectId = 'project-1', organizationId = 'org-1', userId, role }) {
  return {
    id: `membership-${projectId}-${userId}`,
    projectId,
    organizationId,
    userId,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createRepositoryState(overrides = {}) {
  const projectId = overrides.projectId || 'project-1';
  const organizationId = overrides.organizationId || 'org-1';
  return {
    projects: overrides.projects || [
      { id: projectId, ownerRef: 'owner-1', organizationId, name: 'Project' },
    ],
    claims: overrides.claims || [],
    workspaceMembers: overrides.workspaceMembers || [
      { id: 'workspace-owner', organizationId, userId: 'user-owner', role: 'owner' },
      { id: 'workspace-admin', organizationId, userId: 'user-admin', role: 'admin' },
      { id: 'workspace-editor', organizationId, userId: 'user-editor', role: 'member' },
      { id: 'workspace-viewer', organizationId, userId: 'user-viewer', role: 'viewer' },
      { id: 'workspace-other-owner', organizationId, userId: 'user-other-owner', role: 'owner' },
    ],
    personalWorkspaces: overrides.personalWorkspaces || [],
    memberships: overrides.memberships || [],
    locks: [],
    insertAttempts: 0,
  };
}

function createFakeRepository(state = createRepositoryState()) {
  return {
    state,
    transaction(callback) {
      return callback(this);
    },
    async lockProjectMemberships(projectId) {
      state.locks.push(projectId);
    },
    async findProject(projectId) {
      return state.projects.find((project) => project.id === projectId) || null;
    },
    async findClaim(legacyOwnerRef) {
      return state.claims.find((claim) => claim.legacyOwnerRef === legacyOwnerRef) || null;
    },
    async findWorkspaceMembership({ organizationId, userId }) {
      return (
        state.workspaceMembers.find(
          (membership) =>
            membership.organizationId === organizationId && membership.userId === userId
        ) || null
      );
    },
    async findPersonalWorkspaceByOrganizationId(organizationId) {
      return (
        state.personalWorkspaces.find(
          (personalWorkspace) => personalWorkspace.organizationId === organizationId
        ) || null
      );
    },
    async findMembership({ projectId, userId }) {
      return (
        state.memberships.find(
          (membership) => membership.projectId === projectId && membership.userId === userId
        ) || null
      );
    },
    async insertMembership(membership) {
      state.insertAttempts += 1;
      const existing = await this.findMembership(membership);
      if (existing) {
        const err = new Error('duplicate project member');
        err.code = '23505';
        err.constraint = 'dynaxis_project_members_project_user_uidx';
        throw err;
      }
      const row = { id: randomUUID(), ...membership };
      state.memberships.push(row);
      return row;
    },
    async updateMembership({ projectId, userId, role, updatedAt }) {
      const existing = await this.findMembership({ projectId, userId });
      if (!existing) return null;
      existing.role = role;
      existing.updatedAt = updatedAt;
      return existing;
    },
    async deleteMembership({ projectId, userId }) {
      const index = state.memberships.findIndex(
        (membership) => membership.projectId === projectId && membership.userId === userId
      );
      if (index < 0) return null;
      return state.memberships.splice(index, 1)[0];
    },
    async countOtherProjectOwners({ projectId, userId }) {
      return state.memberships.filter(
        (membership) =>
          membership.projectId === projectId &&
          membership.userId !== userId &&
          membership.role === 'owner'
      ).length;
    },
    async listProjectMemberships(projectId) {
      return state.memberships.filter((membership) => membership.projectId === projectId);
    },
  };
}

function createService(state) {
  const repository = createFakeRepository(state);
  return { service: new ProjectMembershipService({ repository }), repository, state };
}

for (const role of ['owner', 'admin', 'editor', 'viewer']) {
  test(`create ${role} Project membership succeeds`, async () => {
    const { service, state } = createService(createRepositoryState());
    const row = await service.create({
      projectId: 'project-1',
      organizationId: 'org-1',
      userId: `user-${role}`,
      role,
    });
    assert.equal(row.role, role);
    assert.equal(row.organizationId, 'org-1');
    assert.equal(state.memberships.length, 1);
    assert.deepEqual(state.locks, ['project-1']);
  });
}

test('create rejects invalid Project role', async () => {
  const { service } = createService(createRepositoryState());
  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-owner', role: 'member' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.INVALID_PROJECT_ROLE)
  );
});

test('create rejects missing Project', async () => {
  const { service } = createService(createRepositoryState({ projects: [] }));
  await assert.rejects(
    service.create({ projectId: 'missing', userId: 'user-owner', role: 'owner' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND)
  );
});

test('create rejects unresolved canonical Workspace', async () => {
  const state = createRepositoryState({
    projects: [{ id: 'project-1', ownerRef: 'unclaimed-owner', organizationId: null }],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-owner', role: 'owner' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED)
  );
});

test('claimed legacy ownership does not substitute for projected Project ownership', async () => {
  const state = createRepositoryState({
    projects: [{ id: 'project-1', ownerRef: 'claimed-owner', organizationId: null }],
    claims: [{ legacyOwnerRef: 'claimed-owner', organizationId: 'org-1' }],
  });
  const { service } = createService(state);

  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-owner', role: 'owner' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED)
  );
  assert.equal(state.insertAttempts, 0);
  assert.equal(state.memberships.length, 0);

  state.projects[0].organizationId = 'org-1';
  const row = await service.create({ projectId: 'project-1', userId: 'user-owner', role: 'owner' });
  assert.equal(row.organizationId, 'org-1');
  assert.equal(row.role, 'owner');
  assert.equal(state.insertAttempts, 1);
  assert.equal(state.memberships.length, 1);
});

test('unprojected claimed legacy Project is not a membership domain for any operation', async () => {
  const existing = makeMembership({ userId: 'user-owner', role: 'owner' });
  const state = createRepositoryState({
    projects: [{ id: 'project-1', ownerRef: 'claimed-owner', organizationId: null }],
    claims: [{ legacyOwnerRef: 'claimed-owner', organizationId: 'org-1' }],
    memberships: [existing],
  });
  const { service } = createService(state);

  for (const [operation, action] of [
    [
      'create',
      () => service.create({ projectId: 'project-1', userId: 'user-admin', role: 'admin' }),
    ],
    [
      'update',
      () => service.update({ projectId: 'project-1', userId: 'user-owner', role: 'admin' }),
    ],
    ['remove', () => service.remove({ projectId: 'project-1', userId: 'user-owner' })],
    ['get', () => service.get({ projectId: 'project-1', userId: 'user-owner' })],
    ['list', () => service.list({ projectId: 'project-1' })],
  ]) {
    await assert.rejects(
      action(),
      expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED),
      `${operation} rejects unprojected claimed legacy Project`
    );
  }
  assert.deepEqual(state.memberships, [existing]);
});

test('create resolves legacy claim ownership and rejects Workspace mismatch', async () => {
  const state = createRepositoryState({
    projects: [{ id: 'project-1', ownerRef: 'claimed-owner', organizationId: 'org-1' }],
    claims: [{ legacyOwnerRef: 'claimed-owner', organizationId: 'org-1' }],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.create({
      projectId: 'project-1',
      organizationId: 'org-2',
      userId: 'user-owner',
      role: 'owner',
    }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.WORKSPACE_MISMATCH)
  );
});

test('create rejects user outside owning Better Auth Workspace', async () => {
  const { service } = createService(createRepositoryState());
  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-outsider', role: 'viewer' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.USER_NOT_WORKSPACE_MEMBER)
  );
});

test('create rejects duplicate Project membership deterministically', async () => {
  const state = createRepositoryState({
    memberships: [makeMembership({ userId: 'user-owner', role: 'owner' })],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-owner', role: 'owner' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_ALREADY_EXISTS)
  );
});

test('get returns existing membership and null for missing membership', async () => {
  const existing = makeMembership({ userId: 'user-owner', role: 'owner' });
  const { service } = createService(createRepositoryState({ memberships: [existing] }));
  assert.equal(await service.get({ projectId: 'project-1', userId: 'user-owner' }), existing);
  assert.equal(await service.get({ projectId: 'project-1', userId: 'user-admin' }), null);
});

test('list returns canonical Project memberships', async () => {
  const owner = makeMembership({ userId: 'user-owner', role: 'owner' });
  const viewer = makeMembership({ userId: 'user-viewer', role: 'viewer' });
  const { service } = createService(createRepositoryState({ memberships: [owner, viewer] }));
  assert.deepEqual(await service.list({ projectId: 'project-1' }), [owner, viewer]);
});

for (const role of ['admin', 'editor', 'viewer']) {
  test(`update owner to ${role} succeeds when another Project owner remains`, async () => {
    const state = createRepositoryState({
      memberships: [
        makeMembership({ userId: 'user-owner', role: 'owner' }),
        makeMembership({ userId: 'user-other-owner', role: 'owner' }),
      ],
    });
    const { service } = createService(state);
    const row = await service.update({ projectId: 'project-1', userId: 'user-owner', role });
    assert.equal(row.role, role);
  });
}

test('update rejects final Project owner demotion', async () => {
  const state = createRepositoryState({
    memberships: [makeMembership({ userId: 'user-owner', role: 'owner' })],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.update({ projectId: 'project-1', userId: 'user-owner', role: 'admin' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.LAST_PROJECT_OWNER)
  );
});

test('update rejects invalid role and missing membership', async () => {
  const { service } = createService(createRepositoryState());
  await assert.rejects(
    service.update({ projectId: 'project-1', userId: 'user-owner', role: 'member' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.INVALID_PROJECT_ROLE)
  );
  await assert.rejects(
    service.update({ projectId: 'project-1', userId: 'user-owner', role: 'viewer' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND)
  );
});

test('remove non-owner succeeds', async () => {
  const state = createRepositoryState({
    memberships: [
      makeMembership({ userId: 'user-owner', role: 'owner' }),
      makeMembership({ userId: 'user-viewer', role: 'viewer' }),
    ],
  });
  const { service } = createService(state);
  const removed = await service.remove({ projectId: 'project-1', userId: 'user-viewer' });
  assert.equal(removed.role, 'viewer');
  assert.equal(state.memberships.length, 1);
});

test('remove owner succeeds when another owner remains', async () => {
  const state = createRepositoryState({
    memberships: [
      makeMembership({ userId: 'user-owner', role: 'owner' }),
      makeMembership({ userId: 'user-other-owner', role: 'owner' }),
    ],
  });
  const { service } = createService(state);
  const removed = await service.remove({ projectId: 'project-1', userId: 'user-owner' });
  assert.equal(removed.role, 'owner');
  assert.equal(state.memberships.length, 1);
});

test('remove rejects final owner and missing membership', async () => {
  const state = createRepositoryState({
    memberships: [makeMembership({ userId: 'user-owner', role: 'owner' })],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.remove({ projectId: 'project-1', userId: 'user-owner' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.LAST_PROJECT_OWNER)
  );
  await assert.rejects(
    service.remove({ projectId: 'project-1', userId: 'user-viewer' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND)
  );
});

test('personal Workspace owner membership succeeds', async () => {
  const state = createRepositoryState({
    personalWorkspaces: [{ userId: 'user-owner', organizationId: 'org-1' }],
  });
  const { service } = createService(state);
  const row = await service.create({ projectId: 'project-1', userId: 'user-owner', role: 'owner' });
  assert.equal(row.userId, 'user-owner');
});

test('personal Workspace non-owner and arbitrary sharing are rejected', async () => {
  const state = createRepositoryState({
    personalWorkspaces: [{ userId: 'user-owner', organizationId: 'org-1' }],
  });
  const { service } = createService(state);
  await assert.rejects(
    service.create({ projectId: 'project-1', userId: 'user-viewer', role: 'viewer' }),
    expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.USER_NOT_WORKSPACE_MEMBER)
  );
  assert.equal(state.memberships.length, 0);
});

test('Project service exposes canonical membership service boundary', () => {
  assert.ok(projectServiceImpl.memberships instanceof ProjectMembershipService);
});

function runChecked(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...opts,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C', ...(opts.env || {}) },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`
    );
  }
  return result;
}

function applyMigrations(sql) {
  const migrationFiles = [
    '0000_dynaxis_platform.sql',
    '0001_dynaxis_characters.sql',
    '0002_dynaxis_products.sql',
    '0003_dynaxis_brands.sql',
    '0004_dynaxis_campaigns.sql',
    '0005_dynaxis_compositions.sql',
    '0006_dynaxis_design_templates.sql',
    '0007_dynaxis_design_components.sql',
    '0008_dynaxis_design_systems.sql',
    '0009_phase_7c_1_better_auth_foundation.sql',
    '0010_phase_7c_2_workspace_foundation.sql',
    '0011_phase_7c_3_legacy_owner_claims.sql',
    '0012_phase_7c_4_workspace_ownership.sql',
    '0013_phase_7c_5_project_membership.sql',
  ];
  return sql.begin(async (tx) => {
    await tx`create extension if not exists pgcrypto`;
    for (const file of migrationFiles) {
      const body = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
      for (const statement of body.split('--> statement-breakpoint')) {
        const trimmed = statement.trim();
        if (trimmed) {
          await tx.unsafe(trimmed);
        }
      }
    }
  });
}

async function withPostgres(callback) {
  const pgBin = '/opt/homebrew/bin';
  const baseDir = mkdtempSync(join(tmpdir(), 'dynaxis-project-membership-pg-'));
  const dataDir = join(baseDir, 'data');
  const logFile = join(baseDir, 'postgres.log');
  const port = String(45900 + Math.floor(Math.random() * 1000));

  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  let sqlClient = null;
  let started = false;
  try {
    runChecked(join(pgBin, 'initdb'), ['-D', dataDir, '-A', 'trust', '-U', 'postgres'], {
      cwd: ROOT.pathname,
    });
    runChecked(
      join(pgBin, 'pg_ctl'),
      [
        '-D',
        dataDir,
        '-l',
        logFile,
        '-o',
        `-p ${port} -c listen_addresses=127.0.0.1`,
        'start',
      ],
      { cwd: ROOT.pathname }
    );
    started = true;
    sqlClient = postgres(url, { max: 8, prepare: false });
    await applyMigrations(sqlClient);
    const db = drizzle(sqlClient, { schema: DRIZZLE_SCHEMA });
    return await callback({ db });
  } finally {
    if (sqlClient) {
      await sqlClient.end({ timeout: 5 });
    }
    if (started) {
      runChecked(join(pgBin, 'pg_ctl'), ['-D', dataDir, 'stop', '-m', 'fast'], {
        cwd: ROOT.pathname,
      });
    }
    rmSync(baseDir, { recursive: true, force: true });
  }
}

async function seedPgProject(db) {
  const orgId = randomUUID();
  const ownerId = randomUUID();
  const projectId = randomUUID();
  await db.insert(user).values({
    id: ownerId,
    name: 'Owner',
    email: `${ownerId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values({
    id: orgId,
    name: 'Workspace',
    slug: `workspace-${orgId}`,
    createdAt: new Date(),
    metadata: null,
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: orgId,
    userId: ownerId,
    role: 'owner',
    createdAt: new Date(),
  });
  await db.insert(dynaxisProjects).values({
    id: projectId,
    ownerRef: `owner-${projectId}`,
    organizationId: orgId,
    name: 'Concurrent Project',
    status: 'active',
    isDefault: false,
    metadata: {},
  });
  await db.insert(dynaxisProjectMembers).values({
    projectId,
    organizationId: orgId,
    userId: ownerId,
    role: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { orgId, ownerId, projectId };
}

async function seedPgClaimedLegacyProject(db) {
  const orgId = randomUUID();
  const ownerId = randomUUID();
  const projectId = randomUUID();
  await db.insert(user).values({
    id: ownerId,
    name: 'Claimed Owner',
    email: `${ownerId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values({
    id: orgId,
    name: 'Claimed Workspace',
    slug: `claimed-workspace-${orgId}`,
    createdAt: new Date(),
    metadata: null,
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: orgId,
    userId: ownerId,
    role: 'owner',
    createdAt: new Date(),
  });
  await db.insert(dynaxisOwnerRefClaims).values({
    legacyOwnerRef: 'claimed-owner',
    organizationId: orgId,
    claimedByUserId: ownerId,
    claimedAt: new Date(),
    metadata: {},
  });
  await db.insert(dynaxisProjects).values({
    id: projectId,
    ownerRef: 'claimed-owner',
    organizationId: null,
    name: 'Claimed Legacy Project',
    status: 'active',
    isDefault: false,
    metadata: {},
  });
  return { orgId, ownerId, projectId };
}

test('PostgreSQL regression: claimed legacy Project requires projected ownership', async () => {
  await withPostgres(async ({ db }) => {
    const { orgId, ownerId, projectId } = await seedPgClaimedLegacyProject(db);
    const service = new ProjectMembershipService({
      repository: createDrizzleProjectMembershipRepository(db),
    });

    await assert.rejects(
      service.create({ projectId, userId: ownerId, role: 'owner' }),
      expectCode(PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED)
    );
    let rows = await db
      .select()
      .from(dynaxisProjectMembers)
      .where(eq(dynaxisProjectMembers.projectId, projectId));
    assert.equal(rows.length, 0);

    await db
      .update(dynaxisProjects)
      .set({ organizationId: orgId })
      .where(eq(dynaxisProjects.id, projectId));

    const row = await service.create({ projectId, userId: ownerId, role: 'owner' });
    assert.equal(row.organizationId, orgId);
    assert.equal(row.userId, ownerId);
    rows = await db
      .select()
      .from(dynaxisProjectMembers)
      .where(eq(dynaxisProjectMembers.projectId, projectId));
    assert.equal(rows.length, 1);
  });
});

test('PostgreSQL concurrency: concurrent final owner removal cannot leave zero owners', async () => {
  await withPostgres(async ({ db }) => {
    const { projectId, ownerId } = await seedPgProject(db);
    const service = new ProjectMembershipService({
      repository: createDrizzleProjectMembershipRepository(db),
    });
    const attempts = await Promise.allSettled([
      service.remove({ projectId, userId: ownerId }),
      service.remove({ projectId, userId: ownerId }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 2);
    assert.ok(
      attempts.every(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason?.code === PROJECT_MEMBERSHIP_ERROR_CODES.LAST_PROJECT_OWNER
      )
    );
    const rows = await db
      .select()
      .from(dynaxisProjectMembers)
      .where(eq(dynaxisProjectMembers.projectId, projectId));
    assert.equal(rows.filter((row) => row.role === 'owner').length, 1);
  });
});

test('PostgreSQL concurrency: concurrent final owner demotion cannot leave zero owners', async () => {
  await withPostgres(async ({ db }) => {
    const { projectId, ownerId } = await seedPgProject(db);
    const service = new ProjectMembershipService({
      repository: createDrizzleProjectMembershipRepository(db),
    });
    const attempts = await Promise.allSettled([
      service.update({ projectId, userId: ownerId, role: 'viewer' }),
      service.update({ projectId, userId: ownerId, role: 'admin' }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 2);
    assert.ok(
      attempts.every(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason?.code === PROJECT_MEMBERSHIP_ERROR_CODES.LAST_PROJECT_OWNER
      )
    );
    const rows = await db
      .select()
      .from(dynaxisProjectMembers)
      .where(eq(dynaxisProjectMembers.projectId, projectId));
    assert.equal(rows.filter((row) => row.role === 'owner').length, 1);
  });
});
