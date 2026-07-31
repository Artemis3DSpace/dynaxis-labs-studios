import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  AUTH_SCHEMA_NAME,
  BETTER_AUTH_DRIZZLE_SCHEMA,
  BETTER_AUTH_ORGANIZATION_MODELS,
  invitation,
  member,
  organization,
  session,
  user,
} from '../lib/dynaxis/auth/schema.js';
import {
  DYNAXIS_WORKSPACE_ACCESS_SUMMARY,
  DYNAXIS_WORKSPACE_ROLE_NAMES,
  dynaxisWorkspaceRoles,
} from '../lib/dynaxis/auth/workspace-access.js';
import { createDynaxisAuthOptions } from '../lib/dynaxis/auth/options.js';
import { DYNAXIS_IDENTITY_DRIZZLE_SCHEMA, dynaxisPersonalWorkspaces } from '../lib/dynaxis/identity/schema.js';
import {
  DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE,
  DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING_CODE,
  ensurePersonalWorkspaceForUser,
  personalWorkspaceSlugForUserId,
} from '../lib/dynaxis/identity/personal-workspace.js';
import {
  DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE,
  assertPersonalWorkspaceMutationAllowed,
  createDynaxisWorkspaceOrganizationHooks,
} from '../lib/dynaxis/identity/workspace-protection.js';
import { resolveSessionActiveOrganization } from '../lib/dynaxis/identity/session-workspace.js';
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js';

const ROOT = new URL('..', import.meta.url);

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function tableKey(table) {
  return `${getTableConfig(table).schema || 'public'}.${getTableName(table)}`;
}

function createFakeDb({ users = [], mappings = [], organizations = [], members = [] } = {}) {
  const state = {
    users,
    mappings,
    organizations,
    members,
    conflictNextMappingInsert: false,
    conflictMappingRow: null,
  };

  function rowsFor(table) {
    const key = tableKey(table);
    if (key === tableKey(user)) return state.users;
    if (key === tableKey(dynaxisPersonalWorkspaces)) return state.mappings;
    if (key === tableKey(organization)) return state.organizations;
    if (key === tableKey(member)) return state.members;
    return [];
  }

  function pushRow(table, row) {
    const key = tableKey(table);
    if (key === tableKey(organization)) state.organizations.push(row);
    if (key === tableKey(member)) {
      if (!state.members.some((item) => item.userId === row.userId && item.organizationId === row.organizationId)) {
        state.members.push(row);
      }
    }
    if (key === tableKey(dynaxisPersonalWorkspaces)) {
      if (state.conflictNextMappingInsert) {
        state.conflictNextMappingInsert = false;
        if (state.conflictMappingRow) {
          state.mappings.push(state.conflictMappingRow);
        }
        return [];
      }
      if (!state.mappings.some((item) => item.userId === row.userId)) {
        state.mappings.push(row);
        return [row];
      }
      return [];
    }
    return [row];
  }

  const db = {
    state,
    transaction(callback) {
      return callback(db);
    },
    select() {
      return {
        from(table) {
          return {
            where() {
              return {
                async limit() {
                  return rowsFor(table);
                },
              };
            },
          };
        },
      };
    },
    insert(table) {
      let row;
      return {
        values(value) {
          row = value;
          return this;
        },
        onConflictDoNothing() {
          if (tableKey(table) === tableKey(member)) {
            pushRow(table, row);
          }
          return this;
        },
        async returning() {
          return pushRow(table, row);
        },
      };
    },
    update(table) {
      return {
        set(patch) {
          return {
            async where() {
              if (tableKey(table) === tableKey(member)) {
                for (const row of state.members) {
                  Object.assign(row, patch);
                }
              }
              return [];
            },
          };
        },
      };
    },
  };

  return db;
}

test('Phase 7C.2 enables Better Auth organization schema without teams or dynamic roles', () => {
  assert.deepEqual(BETTER_AUTH_ORGANIZATION_MODELS, ['organization', 'member', 'invitation']);

  for (const table of [organization, member, invitation]) {
    assert.equal(getTableConfig(table).schema, AUTH_SCHEMA_NAME);
  }

  assert.equal(getTableName(organization), 'organization');
  assert.equal(getTableName(member), 'member');
  assert.equal(getTableName(invitation), 'invitation');
  assert.equal(getTableColumns(session).activeOrganizationId.columnType, 'PgUUID');
  assert.equal(getTableColumns(member).organizationId.columnType, 'PgUUID');
  assert.equal(getTableColumns(member).userId.columnType, 'PgUUID');
  assert.equal(getTableColumns(invitation).organizationId.columnType, 'PgUUID');

  assert.ok(!('team' in BETTER_AUTH_DRIZZLE_SCHEMA));
  assert.ok(!('teamMember' in BETTER_AUTH_DRIZZLE_SCHEMA));
  assert.ok(!('organizationRole' in BETTER_AUTH_DRIZZLE_SCHEMA));
});

test('workspace roles preserve Better Auth defaults and add static viewer', () => {
  assert.deepEqual(DYNAXIS_WORKSPACE_ROLE_NAMES, ['owner', 'admin', 'member', 'viewer']);
  assert.ok(dynaxisWorkspaceRoles.owner);
  assert.ok(dynaxisWorkspaceRoles.admin);
  assert.ok(dynaxisWorkspaceRoles.member);
  assert.ok(dynaxisWorkspaceRoles.viewer);
  assert.equal(DYNAXIS_WORKSPACE_ACCESS_SUMMARY.dynamicAccessControl, false);
  assert.equal(DYNAXIS_WORKSPACE_ACCESS_SUMMARY.organizationRoleTable, false);
});

test('personal workspace mapping lives in public schema with one user and organization each', () => {
  const config = getTableConfig(dynaxisPersonalWorkspaces);
  const columns = getTableColumns(dynaxisPersonalWorkspaces);

  assert.equal(config.schema, undefined);
  assert.equal(config.name, 'dynaxis_personal_workspaces');
  assert.equal(columns.userId.primary, true);
  assert.equal(columns.userId.columnType, 'PgUUID');
  assert.equal(columns.organizationId.columnType, 'PgUUID');
  assert.ok('dynaxisPersonalWorkspaces' in DYNAXIS_IDENTITY_DRIZZLE_SCHEMA);
  assert.ok('dynaxisPersonalWorkspaces' in DRIZZLE_SCHEMA);
});

test('auth options configure organization plugin and session workspace hook without enabling signup', () => {
  const options = createDynaxisAuthOptions({
    database: { id: 'test-adapter' },
    databaseHooks: { session: { create: { before: async () => {} } } },
    organizationHooks: { beforeAddMember: async () => {} },
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'secret',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
  });

  assert.equal(options.emailAndPassword.disableSignUp, true);
  assert.equal(options.plugins.length, 1);
  assert.equal(options.plugins[0].id, 'organization');
  assert.equal(options.plugins[0].options.allowUserToCreateOrganization, false);
  assert.equal(options.plugins[0].options.disableOrganizationDeletion, true);
  assert.equal(options.plugins[0].options.teams.enabled, false);
  assert.equal(options.plugins[0].options.dynamicAccessControl.enabled, false);
  assert.equal(typeof options.databaseHooks.session.create.before, 'function');
});

test('personal workspace provisioning is idempotent and creates owner membership', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Sotira', email: 'sotira@example.test' }],
  });

  const first = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Sotira' }, { db });
  const second = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Sotira' }, { db });

  assert.equal(first.userId, userId);
  assert.equal(second.userId, userId);
  assert.equal(db.state.organizations.length, 1);
  assert.equal(db.state.members.length, 1);
  assert.equal(db.state.members[0].role, DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE);
  assert.equal(db.state.organizations[0].slug, personalWorkspaceSlugForUserId(userId));
});

test('personal workspace provisioning rereads mapping when a concurrent insert wins', async () => {
  const userId = '22222222-2222-4222-8222-222222222222';
  const organizationId = '33333333-3333-4333-8333-333333333333';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Race', email: 'race@example.test' }],
  });
  db.state.conflictNextMappingInsert = true;
  db.state.conflictMappingRow = { userId, organizationId, createdAt: new Date() };

  const workspace = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Race' }, { db });
  assert.equal(workspace.organizationId, organizationId);
});

test('personal workspace provisioning repairs a missing owner membership row', async () => {
  const userId = '88888888-8888-4888-8888-888888888888';
  const organizationId = '99999999-9999-4999-8999-999999999999';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Drift', email: 'drift@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [{ id: organizationId, slug: personalWorkspaceSlugForUserId(userId) }],
    members: [],
  });

  const workspace = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Drift' }, { db });

  assert.equal(workspace.organizationId, organizationId);
  assert.equal(db.state.members.length, 1);
  assert.equal(db.state.members[0].userId, userId);
  assert.equal(db.state.members[0].organizationId, organizationId);
  assert.equal(db.state.members[0].role, DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE);
});

test('personal workspace provisioning restores a downgraded owner role', async () => {
  const userId = '10101010-1010-4101-8101-101010101010';
  const organizationId = '20202020-2020-4202-8202-202020202020';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Downgraded', email: 'downgraded@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [{ id: organizationId, slug: personalWorkspaceSlugForUserId(userId) }],
    members: [{ id: 'member-1', organizationId, userId, role: 'member', createdAt: new Date() }],
  });

  await ensurePersonalWorkspaceForUser({ id: userId, name: 'Downgraded' }, { db });

  assert.equal(db.state.members.length, 1);
  assert.equal(db.state.members[0].role, DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE);
});

test('personal workspace provisioning fails closed when the mapped organization is missing', async () => {
  const userId = '30303030-3030-4303-8303-303030303030';
  const organizationId = '40404040-4040-4404-8404-404040404040';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Orphan', email: 'orphan@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [],
    members: [],
  });

  await assert.rejects(
    ensurePersonalWorkspaceForUser({ id: userId, name: 'Orphan' }, { db }),
    (err) => err.code === DYNAXIS_PERSONAL_WORKSPACE_ORGANIZATION_MISSING_CODE
  );
});

test('personal workspace provisioning converges safely across repeated calls after a repair', async () => {
  const userId = '50505050-5050-4505-8505-505050505050';
  const organizationId = '60606060-6060-4606-8606-606060606060';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Repeat', email: 'repeat@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [{ id: organizationId, slug: personalWorkspaceSlugForUserId(userId) }],
    members: [],
  });

  const first = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Repeat' }, { db });
  const second = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Repeat' }, { db });
  const third = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Repeat' }, { db });

  assert.equal(first.organizationId, organizationId);
  assert.equal(second.organizationId, organizationId);
  assert.equal(third.organizationId, organizationId);
  assert.equal(db.state.organizations.length, 1);
  assert.equal(db.state.members.length, 1);
  assert.equal(db.state.mappings.length, 1);
});

test('WP-7C-22 personal workspace provisioning resists repeated membership-drop abuse by repairing every time', async () => {
  const userId = '70707070-7070-4707-8707-707070707070';
  const organizationId = '80808080-8080-4808-8808-808080808080';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Repeated Drop', email: 'repeated-drop@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [{ id: organizationId, slug: personalWorkspaceSlugForUserId(userId) }],
    members: [],
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const workspace = await ensurePersonalWorkspaceForUser({ id: userId, name: 'Repeated Drop' }, { db });
    assert.equal(workspace.organizationId, organizationId);
    assert.equal(db.state.members.length, 1);
    assert.equal(db.state.members[0].role, DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE);
    db.state.members.length = 0;
  }

  assert.equal(db.state.organizations.length, 1);
  assert.equal(db.state.mappings.length, 1);
});

test('personal workspace protections reject member and invitation mutations', async () => {
  const personalOrganizationId = '44444444-4444-4444-8444-444444444444';
  const db = createFakeDb({
    mappings: [
      {
        userId: '55555555-5555-4555-8555-555555555555',
        organizationId: personalOrganizationId,
        createdAt: new Date(),
      },
    ],
  });

  for (const action of ['deleteOrganization', 'inviteMember', 'addMember', 'removeMember']) {
    await assert.rejects(
      assertPersonalWorkspaceMutationAllowed(
        { organizationId: personalOrganizationId, action, member: { role: 'owner' } },
        { db }
      ),
      (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
    );
  }

  await assert.rejects(
    assertPersonalWorkspaceMutationAllowed(
      {
        organizationId: personalOrganizationId,
        action: 'updateMemberRole',
        member: { role: 'owner' },
        newRole: 'member',
      },
      { db }
    ),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
});

test('WP-7C-22 personal workspace organization hooks reject every governance mutation entry point', async () => {
  const personalOrganizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const db = createFakeDb({
    mappings: [
      { userId: 'user-hooked', organizationId: personalOrganizationId, createdAt: new Date() },
    ],
  });
  const hooks = createDynaxisWorkspaceOrganizationHooks({ db });

  await assert.rejects(
    hooks.beforeDeleteOrganization({ organization: { id: personalOrganizationId } }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
  await assert.rejects(
    hooks.beforeAddMember({ member: { organizationId: personalOrganizationId } }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
  await assert.rejects(
    hooks.beforeRemoveMember({ member: { organizationId: personalOrganizationId, role: 'owner' } }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
  await assert.rejects(
    hooks.beforeUpdateMemberRole({
      member: { organizationId: personalOrganizationId, role: 'owner' },
      newRole: 'member',
    }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
  await assert.rejects(
    hooks.beforeCreateInvitation({ invitation: { organizationId: personalOrganizationId } }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
  await assert.rejects(
    hooks.beforeAcceptInvitation({ invitation: { organizationId: personalOrganizationId } }),
    (err) => err.body?.code === DYNAXIS_PERSONAL_WORKSPACE_PROTECTED_CODE
  );
});

test('WP-7C-22 personal workspace member role update hook allows role changes that keep ownership', async () => {
  const personalOrganizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const db = createFakeDb({
    mappings: [
      { userId: 'user-kept-owner', organizationId: personalOrganizationId, createdAt: new Date() },
    ],
  });
  const hooks = createDynaxisWorkspaceOrganizationHooks({ db });

  await assert.doesNotReject(
    hooks.beforeUpdateMemberRole({
      member: { organizationId: personalOrganizationId, role: 'owner' },
      newRole: 'owner,admin',
    })
  );
});

test('session workspace hook initializes missing active organization to personal workspace', async () => {
  const userId = '66666666-6666-4666-8666-666666666666';
  const organizationId = '77777777-7777-4777-8777-777777777777';
  const db = createFakeDb({
    users: [{ id: userId, name: 'Session', email: 'session@example.test' }],
    mappings: [{ userId, organizationId, createdAt: new Date() }],
    organizations: [{ id: organizationId, slug: personalWorkspaceSlugForUserId(userId) }],
    members: [{ id: 'member-session', organizationId, userId, role: DYNAXIS_PERSONAL_WORKSPACE_OWNER_ROLE, createdAt: new Date() }],
  });

  const session = await resolveSessionActiveOrganization({ id: 'session-id', userId }, { db });
  assert.equal(session.activeOrganizationId, organizationId);
});

test('Phase 7C.2 does not add provider connections, project auth, or runtime UI changes', () => {
  assert.doesNotMatch(source('lib/dynaxis/identity/personal-workspace.js'), /provider connection/i);
  assert.doesNotMatch(source('lib/dynaxis/identity/personal-workspace.js'), /project membership/i);
  assert.doesNotMatch(source('lib/dynaxis/auth/client.js'), /localStorage|cookie/i);
});

test('WP-7C-21 personal and session workspace provisioning never treat owner_ref as identity authority', () => {
  const personalWorkspaceSource = source('lib/dynaxis/identity/personal-workspace.js');
  const sessionWorkspaceSource = source('lib/dynaxis/identity/session-workspace.js');
  assert.doesNotMatch(personalWorkspaceSource, /owner_ref|ownerRef/);
  assert.doesNotMatch(sessionWorkspaceSource, /owner_ref|ownerRef/);
});

test('WP-7C-22 personal workspace organization hooks never treat owner_ref as identity authority', () => {
  assert.doesNotMatch(source('lib/dynaxis/identity/workspace-protection.js'), /owner_ref|ownerRef/);
});
