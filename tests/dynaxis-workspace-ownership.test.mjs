import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  dynaxisAssets,
  dynaxisBrandRevisions,
  dynaxisBrands,
  dynaxisCampaigns,
  dynaxisCharacters,
  dynaxisCharacterRevisions,
  dynaxisCompositions,
  dynaxisDesignComponentRevisions,
  dynaxisDesignComponents,
  dynaxisDesignComponentSets,
  dynaxisDesignComponentSetVariants,
  dynaxisDesignSystems,
  dynaxisDesignSystemRevisions,
  dynaxisDesignTemplateRevisions,
  dynaxisDesignTemplates,
  dynaxisGenerations,
  dynaxisJobs,
  dynaxisProducts,
  dynaxisProductRevisions,
  dynaxisProjects,
} from '../lib/dynaxis/db/schema.js';
import {
  DYNAXIS_WORKSPACE_OWNED_ROOTS,
  DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES,
  projectWorkspaceOwnershipForLegacyOwnerRef,
  resolveCanonicalResourceOrganization,
  resolveOrganizationIdForLegacyOwnerRef,
  resolveProjectOrganization,
} from '../lib/dynaxis/identity/workspace-ownership.js';
import { claimLegacyOwner } from '../lib/dynaxis/identity/legacy-owner-claims.js';
import { LOCAL_PREVIEW_KEY, ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';

const ROOT = new URL('..', import.meta.url);
const MIGRATION = readFileSync(
  new URL('drizzle/0012_phase_7c_4_workspace_ownership.sql', ROOT),
  'utf8'
);

const ROOT_TABLES = [
  ['project', dynaxisProjects, 'dynaxis_projects', 'dynaxis_projects_organization_idx'],
  ['character', dynaxisCharacters, 'dynaxis_characters', 'dynaxis_characters_organization_idx'],
  ['product', dynaxisProducts, 'dynaxis_products', 'dynaxis_products_organization_idx'],
  ['brand', dynaxisBrands, 'dynaxis_brands', 'dynaxis_brands_organization_idx'],
  [
    'designTemplate',
    dynaxisDesignTemplates,
    'dynaxis_design_templates',
    'dynaxis_design_templates_organization_idx',
  ],
  [
    'designComponent',
    dynaxisDesignComponents,
    'dynaxis_design_components',
    'dynaxis_design_components_organization_idx',
  ],
  [
    'designSystem',
    dynaxisDesignSystems,
    'dynaxis_design_systems',
    'dynaxis_design_systems_organization_idx',
  ],
  [
    'designComponentSet',
    dynaxisDesignComponentSets,
    'dynaxis_design_component_sets',
    'dynaxis_design_component_sets_organization_idx',
  ],
];

const CHILD_TABLES = [
  dynaxisGenerations,
  dynaxisJobs,
  dynaxisAssets,
  dynaxisCampaigns,
  dynaxisCompositions,
  dynaxisCharacterRevisions,
  dynaxisProductRevisions,
  dynaxisBrandRevisions,
  dynaxisDesignTemplateRevisions,
  dynaxisDesignComponentRevisions,
  dynaxisDesignSystemRevisions,
  dynaxisDesignComponentSetVariants,
];

function createProjectionRepository({
  claims = [],
  roots = {},
  projects = [],
  conflictOnProject = false,
} = {}) {
  const state = {
    claims,
    roots: Object.fromEntries(
      ROOT_TABLES.map(([root]) => [root, (roots[root] || []).map((row) => ({ ...row }))])
    ),
    projects: projects.map((row) => ({ ...row })),
    projectionCalls: 0,
  };

  return {
    state,
    async findClaim(legacyOwnerRef) {
      return state.claims.find((claim) => claim.legacyOwnerRef === legacyOwnerRef) || null;
    },
    async findProject(projectId) {
      return state.projects.find((project) => project.id === projectId) || null;
    },
    async findOwnershipConflicts({ legacyOwnerRef, organizationId }) {
      return Object.entries(state.roots).flatMap(([root, rows]) =>
        rows
          .filter(
            (row) =>
              row.ownerRef === legacyOwnerRef &&
              row.organizationId != null &&
              row.organizationId !== organizationId
          )
          .map((row) => ({ root, resourceId: row.id }))
      );
    },
    async projectRootOwnership({ legacyOwnerRef, organizationId }) {
      state.projectionCalls += 1;
      const counts = {};
      for (const [root, rows] of Object.entries(state.roots)) {
        let count = 0;
        for (const row of rows) {
          if (row.ownerRef === legacyOwnerRef && row.organizationId == null) {
            row.organizationId = organizationId;
            count += 1;
          }
        }
        counts[root] = count;
      }
      return counts;
    },
  };
}

function claimRepositoryFor7C4({ claims = [], conflictInsertClaim = null, projectionConflict = false } = {}) {
  const projection = createProjectionRepository({ claims });
  const state = {
    ...projection.state,
    users: [{ id: 'user-owner' }],
    organizations: [{ id: 'org-1' }, { id: 'org-2' }],
    members: [
      { id: 'member-owner', userId: 'user-owner', organizationId: 'org-1', role: 'owner' },
      { id: 'member-owner-2', userId: 'user-owner', organizationId: 'org-2', role: 'owner' },
    ],
    conflictInsertClaim,
  };

  return {
    state,
    transaction(callback) {
      return callback(this);
    },
    async findUserById(userId) {
      return state.users.find((user) => user.id === userId) || null;
    },
    async findOrganizationById(organizationId) {
      return state.organizations.find((org) => org.id === organizationId) || null;
    },
    async findMembership({ organizationId, userId }) {
      return (
        state.members.find(
          (member) => member.organizationId === organizationId && member.userId === userId
        ) || null
      );
    },
    async findClaim(legacyOwnerRef) {
      return state.claims.find((claim) => claim.legacyOwnerRef === legacyOwnerRef) || null;
    },
    async insertClaim(claim) {
      if (state.claims.some((item) => item.legacyOwnerRef === claim.legacyOwnerRef)) {
        return null;
      }
      if (state.conflictInsertClaim) {
        state.claims.push(state.conflictInsertClaim);
        state.conflictInsertClaim = null;
        return null;
      }
      state.claims.push(claim);
      return claim;
    },
    async listClaimsForOrganization(organizationId) {
      return state.claims.filter((claim) => claim.organizationId === organizationId);
    },
    async findOwnershipConflicts() {
      return projectionConflict ? [{ root: 'project', resourceId: 'project-conflict' }] : [];
    },
    async projectRootOwnership() {
      state.projectionCalls += 1;
      return {};
    },
  };
}

test('Phase 7C.4 schema adds nullable organization_id only to workspace-owned roots', () => {
  assert.deepEqual(Object.keys(DYNAXIS_WORKSPACE_OWNED_ROOTS), ROOT_TABLES.map(([root]) => root));

  for (const [, table, tableName, indexName] of ROOT_TABLES) {
    const columns = getTableColumns(table);
    const config = getTableConfig(table);
    assert.equal(getTableName(table), tableName);
    assert.equal(columns.organizationId.columnType, 'PgUUID');
    assert.equal(columns.organizationId.notNull, false);
    assert.ok(
      config.indexes.some((idx) => idx.config.name === indexName),
      `${tableName} has organization index`
    );
    assert.match(
      MIGRATION,
      new RegExp(`ALTER TABLE "${tableName}" ADD COLUMN "organization_id" uuid`)
    );
    assert.match(MIGRATION, new RegExp(`CREATE INDEX "${indexName}"`));
    assert.match(MIGRATION, new RegExp(`ALTER TABLE "${tableName}".*ON DELETE restrict`));
  }

  for (const table of CHILD_TABLES) {
    const columns = getTableColumns(table);
    assert.equal(columns.organizationId, undefined, `${getTableName(table)} stays inherited`);
  }
});

test('Phase 7C.4 migration is bounded and backfills only null root ownership from claims', () => {
  assert.doesNotMatch(MIGRATION, /\bDROP\b|\bTRUNCATE\b|DELETE\s+FROM|SET\s+"owner_ref"|SET\s+owner_ref|ADD COLUMN "organization_id" uuid NOT NULL/i);
  assert.doesNotMatch(MIGRATION, /dynaxis_project_members|provider_connections|api_keys/i);
  assert.equal((MIGRATION.match(/ADD COLUMN "organization_id" uuid/g) || []).length, 8);
  assert.equal((MIGRATION.match(/REFERENCES "auth"\."organization"\("id"\)/g) || []).length, 8);
  assert.equal((MIGRATION.match(/CREATE INDEX "dynaxis_.*_organization_idx"/g) || []).length, 8);
  assert.equal((MIGRATION.match(/resource\."organization_id" IS NULL/g) || []).length, 8);
  assert.equal((MIGRATION.match(/claim\."legacy_owner_ref"/g) || []).length, 8);
});

test('workspace ownership resolution prefers direct organization, then claim, then null', async () => {
  const ownerRef = ownerRefFromApiKey('phase-7c-4-claimed');
  const repository = createProjectionRepository({
    claims: [{ legacyOwnerRef: ownerRef, organizationId: 'org-1' }],
  });

  assert.equal(
    await resolveCanonicalResourceOrganization(
      { organizationId: 'org-1', ownerRef },
      { repository }
    ),
    'org-1'
  );
  assert.equal(
    await resolveCanonicalResourceOrganization({ organizationId: null, ownerRef }, { repository }),
    'org-1'
  );
  assert.equal(
    await resolveCanonicalResourceOrganization(
      { organizationId: null, ownerRef: ownerRefFromApiKey('unclaimed') },
      { repository }
    ),
    null
  );
  assert.equal(
    await resolveOrganizationIdForLegacyOwnerRef(ownerRefFromApiKey(LOCAL_PREVIEW_KEY), {
      repository,
    }),
    null
  );
});

test('workspace ownership detects direct organization and claim conflicts', async () => {
  const ownerRef = ownerRefFromApiKey('phase-7c-4-conflict');
  const repository = createProjectionRepository({
    claims: [{ legacyOwnerRef: ownerRef, organizationId: 'org-claimed' }],
  });

  await assert.rejects(
    resolveCanonicalResourceOrganization(
      { organizationId: 'org-other', ownerRef },
      { repository }
    ),
    (err) => err.code === DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.CONFLICT
  );
});

test('workspace ownership projection updates all roots, only matching null rows, and is idempotent', async () => {
  const ownerRef = ownerRefFromApiKey('phase-7c-4-project');
  const otherOwner = ownerRefFromApiKey('phase-7c-4-other');
  const roots = Object.fromEntries(
    ROOT_TABLES.map(([root]) => [
      root,
      [
        { id: `${root}-null`, ownerRef, organizationId: null },
        { id: `${root}-existing`, ownerRef, organizationId: 'org-1' },
        { id: `${root}-other`, ownerRef: otherOwner, organizationId: null },
      ],
    ])
  );
  const repository = createProjectionRepository({ roots });

  const first = await projectWorkspaceOwnershipForLegacyOwnerRef(
    { legacyOwnerRef: ownerRef, organizationId: 'org-1' },
    { repository }
  );
  const second = await projectWorkspaceOwnershipForLegacyOwnerRef(
    { legacyOwnerRef: ownerRef, organizationId: 'org-1' },
    { repository }
  );

  for (const [root] of ROOT_TABLES) {
    assert.equal(first.counts[root], 1);
    assert.equal(second.counts[root], 0);
    assert.equal(repository.state.roots[root][0].organizationId, 'org-1');
    assert.equal(repository.state.roots[root][1].organizationId, 'org-1');
    assert.equal(repository.state.roots[root][2].organizationId, null);
  }
});

test('workspace ownership projection rejects conflicting non-null root ownership', async () => {
  const ownerRef = ownerRefFromApiKey('phase-7c-4-root-conflict');
  const repository = createProjectionRepository({
    roots: {
      project: [{ id: 'project-1', ownerRef, organizationId: 'org-other' }],
    },
  });

  await assert.rejects(
    projectWorkspaceOwnershipForLegacyOwnerRef(
      { legacyOwnerRef: ownerRef, organizationId: 'org-1' },
      { repository }
    ),
    (err) => err.code === DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.CONFLICT
  );
});

test('legacy owner claim integration projects new and idempotent claims but not different-workspace conflicts', async () => {
  const legacyApiKey = 'phase-7c-4-claim-key';
  const ownerRef = ownerRefFromApiKey(legacyApiKey);
  const repository = claimRepositoryFor7C4();

  await claimLegacyOwner(
    { legacyApiKey, organizationId: 'org-1', claimedByUserId: 'user-owner' },
    { repository }
  );
  await claimLegacyOwner(
    { legacyApiKey, organizationId: 'org-1', claimedByUserId: 'user-owner' },
    { repository }
  );
  assert.equal(repository.state.projectionCalls, 2);

  await assert.rejects(
    claimLegacyOwner(
      { legacyApiKey, organizationId: 'org-2', claimedByUserId: 'user-owner' },
      { repository }
    ),
    /Legacy ownership has already been claimed/
  );
  assert.equal(repository.state.projectionCalls, 2);
  assert.equal(repository.state.claims[0].legacyOwnerRef, ownerRef);
});

test('projection conflict aborts the claim transaction contract before success', async () => {
  const repository = claimRepositoryFor7C4({ projectionConflict: true });
  await assert.rejects(
    claimLegacyOwner(
      {
        legacyApiKey: 'phase-7c-4-projection-conflict',
        organizationId: 'org-1',
        claimedByUserId: 'user-owner',
      },
      { repository }
    ),
    (err) => err.code === DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.CONFLICT
  );
});

test('resolveProjectOrganization reads project organization without mutating ownership', async () => {
  const ownerRef = ownerRefFromApiKey('phase-7c-4-project-org');
  const repository = createProjectionRepository({
    claims: [{ legacyOwnerRef: ownerRef, organizationId: 'org-claimed' }],
    projects: [
      { id: 'project-direct', ownerRef, organizationId: 'org-claimed' },
      { id: 'project-claimed', ownerRef, organizationId: null },
    ],
  });

  assert.equal(
    await resolveProjectOrganization('project-direct', { repository }),
    'org-claimed'
  );
  assert.equal(
    await resolveProjectOrganization('project-claimed', { repository }),
    'org-claimed'
  );
  assert.equal(repository.state.projectionCalls, 0);
});

test('canonical root create paths derive organizationId and do not expose request overrides', () => {
  const files = [
    'lib/dynaxis/services/projects.js',
    'lib/dynaxis/services/characters.js',
    'lib/dynaxis/services/products.js',
    'lib/dynaxis/services/brands.js',
    'lib/dynaxis/services/templates.js',
    'lib/dynaxis/services/components.js',
    'lib/dynaxis/services/design-systems.js',
    'lib/dynaxis/services/component-sets.js',
  ];
  for (const file of files) {
    const text = readFileSync(new URL(file, ROOT), 'utf8');
    assert.match(text, /resolveWorkspaceOrganizationForLegacyWrite/);
    assert.match(text, /organizationId/);
    assert.doesNotMatch(text, /organizationId:\s*data\.organizationId/);
  }
});
