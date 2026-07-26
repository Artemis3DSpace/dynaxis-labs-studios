import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { member, organization, user } from '../lib/dynaxis/auth/schema.js';
import {
  DYNAXIS_PROJECT_ROLE_NAMES,
  dynaxisProjectMembers,
  dynaxisProjects,
  parseProjectRole,
} from '../lib/dynaxis/db/schema.js';
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js';

const ROOT = new URL('..', import.meta.url);
const MIGRATION = readFileSync(
  new URL('drizzle/0013_phase_7c_5_project_membership.sql', ROOT),
  'utf8'
);
const WORKSPACE_MIGRATION = readFileSync(
  new URL('drizzle/0010_phase_7c_2_workspace_foundation.sql', ROOT),
  'utf8'
);

function indexNames(table) {
  return getTableConfig(table).indexes.map((idx) => idx.config.name);
}

test('Project membership table lives in public and references canonical Dynaxis/Auth tables', () => {
  const columns = getTableColumns(dynaxisProjectMembers);

  assert.equal(getTableName(dynaxisProjectMembers), 'dynaxis_project_members');
  assert.equal(getTableConfig(dynaxisProjectMembers).schema, undefined);
  assert.equal(columns.id.columnType, 'PgUUID');
  assert.equal(columns.projectId.columnType, 'PgUUID');
  assert.equal(columns.organizationId.columnType, 'PgUUID');
  assert.equal(columns.userId.columnType, 'PgUUID');
  assert.equal(columns.role.columnType, 'PgText');
  assert.equal(columns.projectId.notNull, true);
  assert.equal(columns.organizationId.notNull, true);
  assert.equal(columns.userId.notNull, true);
  assert.equal(columns.role.notNull, true);

  assert.equal(getTableName(dynaxisProjects), 'dynaxis_projects');
  assert.equal(getTableConfig(organization).schema, 'auth');
  assert.equal(getTableName(organization), 'organization');
  assert.equal(getTableConfig(user).schema, 'auth');
  assert.equal(getTableName(user), 'user');
  assert.equal(getTableConfig(member).schema, 'auth');
  assert.equal(getTableName(member), 'member');
  assert.ok('dynaxisProjectMembers' in DRIZZLE_SCHEMA);
});

test('Project membership roles are distinct from workspace roles', () => {
  assert.deepEqual(DYNAXIS_PROJECT_ROLE_NAMES, ['owner', 'admin', 'editor', 'viewer']);
  assert.equal(parseProjectRole('owner'), 'owner');
  assert.equal(parseProjectRole(' admin '), 'admin');
  assert.equal(parseProjectRole('editor'), 'editor');
  assert.equal(parseProjectRole('viewer'), 'viewer');
  assert.equal(parseProjectRole('member'), null);
  assert.equal(parseProjectRole(''), null);

  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_project_members_role_check" CHECK \("role" in \('owner', 'admin', 'editor', 'viewer'\)\)/
  );
});

test('Project membership schema enforces lookup indexes and duplicate prevention', () => {
  assert.ok(
    indexNames(dynaxisProjects).includes('dynaxis_projects_id_organization_uidx'),
    'projects exposes composite unique key for project/workspace membership FK'
  );

  assert.ok(indexNames(dynaxisProjectMembers).includes('dynaxis_project_members_project_user_uidx'));
  assert.ok(indexNames(dynaxisProjectMembers).includes('dynaxis_project_members_project_idx'));
  assert.ok(indexNames(dynaxisProjectMembers).includes('dynaxis_project_members_user_idx'));
  assert.ok(indexNames(dynaxisProjectMembers).includes('dynaxis_project_members_organization_idx'));

  assert.match(
    MIGRATION,
    /CREATE UNIQUE INDEX "dynaxis_project_members_project_user_uidx" ON "dynaxis_project_members" USING btree \("project_id","user_id"\)/
  );
});

test('Migration ties project members to project workspace and Better Auth membership', () => {
  assert.match(
    MIGRATION,
    /FOREIGN KEY \("project_id"\) REFERENCES "public"."dynaxis_projects"\("id"\) ON DELETE cascade/
  );
  assert.match(
    MIGRATION,
    /FOREIGN KEY \("organization_id"\) REFERENCES "auth"."organization"\("id"\) ON DELETE restrict/
  );
  assert.match(
    MIGRATION,
    /FOREIGN KEY \("user_id"\) REFERENCES "auth"."user"\("id"\) ON DELETE cascade/
  );
  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_project_members_project_organization_fk" FOREIGN KEY \("project_id","organization_id"\) REFERENCES "public"."dynaxis_projects"\("id","organization_id"\) ON DELETE cascade/
  );
  assert.match(
    MIGRATION,
    /CONSTRAINT "dynaxis_project_members_workspace_member_fk" FOREIGN KEY \("organization_id","user_id"\) REFERENCES "auth"."member"\("organization_id","user_id"\) ON DELETE cascade/
  );
  assert.match(
    WORKSPACE_MIGRATION,
    /CREATE UNIQUE INDEX "member_organization_user_uidx" ON "auth"."member" USING btree \("organization_id","user_id"\)/
  );
});

test('Migration does not create duplicate project, workspace, or user primitives', () => {
  assert.doesNotMatch(MIGRATION, /CREATE TABLE "dynaxis_projects"/);
  assert.doesNotMatch(MIGRATION, /CREATE TABLE "dynaxis_workspaces"/);
  assert.doesNotMatch(MIGRATION, /CREATE TABLE "dynaxis_users"/);
  assert.doesNotMatch(MIGRATION, /CREATE TABLE "auth"."organization"/);
  assert.doesNotMatch(MIGRATION, /CREATE TABLE "auth"."user"/);
});
