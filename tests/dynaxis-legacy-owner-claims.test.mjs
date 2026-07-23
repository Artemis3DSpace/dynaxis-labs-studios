import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { organization, user } from '../lib/dynaxis/auth/schema.js';
import {
  canClaimLegacyOwnerRef,
  parseWorkspaceRoles,
} from '../lib/dynaxis/auth/workspace-access.js';
import {
  DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES,
  DYNAXIS_LEGACY_OWNER_CLAIM_METADATA,
  claimLegacyOwner,
  deriveClaimableLegacyOwnerRef,
  getLegacyOwnerRefClaim,
  listLegacyOwnerRefClaimsForOrganization,
  resolveOrganizationForLegacyOwnerRef,
} from '../lib/dynaxis/identity/legacy-owner-claims.js';
import { dynaxisOwnerRefClaims } from '../lib/dynaxis/identity/schema.js';
import { LOCAL_PREVIEW_KEY, ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';

const ROOT = new URL('..', import.meta.url);
const SECRET_KEY = 'MUAPI_SUPER_SECRET_SHOULD_NEVER_PERSIST_7C3';

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function createFakeRepository({
  users = [],
  organizations = [],
  members = [],
  claims = [],
  conflictInsertClaim = null,
} = {}) {
  const state = {
    users,
    organizations,
    members,
    claims,
    conflictInsertClaim,
    insertAttempts: 0,
  };

  return {
    state,
    transaction(callback) {
      return callback(this);
    },
    async findUserById(userId) {
      return state.users.find((item) => item.id === userId) || null;
    },
    async findOrganizationById(organizationId) {
      return state.organizations.find((item) => item.id === organizationId) || null;
    },
    async findMembership({ organizationId, userId }) {
      return (
        state.members.find(
          (item) => item.organizationId === organizationId && item.userId === userId
        ) || null
      );
    },
    async findClaim(legacyOwnerRef) {
      return state.claims.find((item) => item.legacyOwnerRef === legacyOwnerRef) || null;
    },
    async insertClaim(claim) {
      state.insertAttempts += 1;
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
      return state.claims.filter((item) => item.organizationId === organizationId);
    },
  };
}

function repositoryForRole(role) {
  return createFakeRepository({
    users: [{ id: 'user-owner', email: 'owner@example.test' }],
    organizations: [{ id: 'org-1', name: 'Org 1' }],
    members: [{ id: 'member-1', userId: 'user-owner', organizationId: 'org-1', role }],
  });
}

test('Phase 7C.3 claim schema uses legacy ownerRef as public primary key', () => {
  const config = getTableConfig(dynaxisOwnerRefClaims);
  const columns = getTableColumns(dynaxisOwnerRefClaims);
  const migration = source('drizzle/0011_phase_7c_3_legacy_owner_claims.sql');

  assert.equal(config.schema, undefined);
  assert.equal(getTableName(dynaxisOwnerRefClaims), 'dynaxis_owner_ref_claims');
  assert.equal(columns.legacyOwnerRef.primary, true);
  assert.equal(columns.legacyOwnerRef.columnType, 'PgText');
  assert.equal(columns.organizationId.columnType, 'PgUUID');
  assert.equal(columns.claimedByUserId.columnType, 'PgUUID');
  assert.equal(columns.metadata.columnType, 'PgJsonb');
  assert.equal(getTableName(organization), 'organization');
  assert.equal(getTableName(user), 'user');
  assert.match(migration, /ON DELETE restrict/);
  assert.match(migration, /ON DELETE set null/);
  assert.match(migration, /dynaxis_owner_ref_claims_organization_idx/);
  assert.match(migration, /dynaxis_owner_ref_claims_claimed_by_user_idx/);
});

test('legacy owner claim authority is limited to owner and admin workspace roles', () => {
  assert.deepEqual(parseWorkspaceRoles('owner, admin'), ['owner', 'admin']);
  assert.equal(canClaimLegacyOwnerRef('owner'), true);
  assert.equal(canClaimLegacyOwnerRef('admin'), true);
  assert.equal(canClaimLegacyOwnerRef('viewer,admin'), true);
  assert.equal(canClaimLegacyOwnerRef('member'), false);
  assert.equal(canClaimLegacyOwnerRef('viewer'), false);
  assert.equal(canClaimLegacyOwnerRef(''), false);
});

test('owner and admin can claim; member, viewer, and non-member cannot', async () => {
  for (const role of ['owner', 'admin']) {
    const repository = repositoryForRole(role);
    const claim = await claimLegacyOwner(
      {
        legacyApiKey: `muapi-${role}-claim-key`,
        organizationId: 'org-1',
        claimedByUserId: 'user-owner',
      },
      { repository }
    );
    assert.equal(claim.organizationId, 'org-1');
  }

  for (const role of ['member', 'viewer']) {
    await assert.rejects(
      claimLegacyOwner(
        {
          legacyApiKey: `muapi-${role}-claim-key`,
          organizationId: 'org-1',
          claimedByUserId: 'user-owner',
        },
        { repository: repositoryForRole(role) }
      ),
      (err) => err.code === DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.FORBIDDEN
    );
  }

  await assert.rejects(
    claimLegacyOwner(
      {
        legacyApiKey: 'muapi-non-member-key',
        organizationId: 'org-1',
        claimedByUserId: 'user-owner',
      },
      {
        repository: createFakeRepository({
          users: [{ id: 'user-owner' }],
          organizations: [{ id: 'org-1' }],
        }),
      }
    ),
    (err) => err.code === DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.FORBIDDEN
  );
});

test('claiming derives ownerRef internally and never persists the raw legacy key', async () => {
  const repository = repositoryForRole('owner');
  const expectedOwnerRef = ownerRefFromApiKey(SECRET_KEY);
  const claim = await claimLegacyOwner(
    {
      legacyApiKey: SECRET_KEY,
      organizationId: 'org-1',
      claimedByUserId: 'user-owner',
    },
    { repository }
  );

  assert.equal(claim.legacyOwnerRef, expectedOwnerRef);
  assert.deepEqual(claim.metadata, DYNAXIS_LEGACY_OWNER_CLAIM_METADATA);
  assert.doesNotMatch(JSON.stringify(claim), new RegExp(SECRET_KEY));
  assert.doesNotMatch(JSON.stringify(repository.state.claims), new RegExp(SECRET_KEY));
  assert.doesNotMatch(JSON.stringify(claim.metadata), new RegExp(SECRET_KEY));
});

test('preview/local owner refs are not claimable', async () => {
  assert.throws(
    () => deriveClaimableLegacyOwnerRef(LOCAL_PREVIEW_KEY),
    (err) => err.code === DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.PREVIEW_NOT_ALLOWED
  );
  assert.throws(
    () => deriveClaimableLegacyOwnerRef(ownerRefFromApiKey(LOCAL_PREVIEW_KEY)),
    (err) => err.code === DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.PREVIEW_NOT_ALLOWED
  );
});

test('same workspace claims are idempotent and preserve original claim event', async () => {
  const repository = createFakeRepository({
    users: [
      { id: 'user-owner' },
      { id: 'user-admin' },
    ],
    organizations: [{ id: 'org-1' }],
    members: [
      { id: 'member-owner', userId: 'user-owner', organizationId: 'org-1', role: 'owner' },
      { id: 'member-admin', userId: 'user-admin', organizationId: 'org-1', role: 'admin' },
    ],
  });

  const first = await claimLegacyOwner(
    {
      legacyApiKey: 'muapi-shared-idempotent-key',
      organizationId: 'org-1',
      claimedByUserId: 'user-owner',
    },
    { repository }
  );
  const originalClaimedAt = first.claimedAt;

  const second = await claimLegacyOwner(
    {
      legacyApiKey: 'muapi-shared-idempotent-key',
      organizationId: 'org-1',
      claimedByUserId: 'user-admin',
    },
    { repository }
  );

  assert.equal(repository.state.claims.length, 1);
  assert.equal(second.claimedByUserId, 'user-owner');
  assert.equal(second.claimedAt, originalClaimedAt);
  assert.deepEqual(second.metadata, DYNAXIS_LEGACY_OWNER_CLAIM_METADATA);
});

test('different workspace receives canonical conflict without owner details or raw key', async () => {
  const legacyOwnerRef = ownerRefFromApiKey(SECRET_KEY);
  const repository = createFakeRepository({
    users: [{ id: 'user-admin' }],
    organizations: [{ id: 'org-2', name: 'Requester Org' }],
    members: [{ id: 'member-admin', userId: 'user-admin', organizationId: 'org-2', role: 'admin' }],
    claims: [
      {
        legacyOwnerRef,
        organizationId: 'org-secret-owner',
        claimedByUserId: 'secret-user',
        claimedAt: new Date('2026-01-01T00:00:00Z'),
        metadata: DYNAXIS_LEGACY_OWNER_CLAIM_METADATA,
      },
    ],
  });

  await assert.rejects(
    claimLegacyOwner(
      {
        legacyApiKey: SECRET_KEY,
        organizationId: 'org-2',
        claimedByUserId: 'user-admin',
      },
      { repository }
    ),
    (err) => {
      const serialized = JSON.stringify(err);
      assert.equal(err.code, DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.CONFLICT);
      assert.equal(err.status, 409);
      assert.doesNotMatch(serialized, /org-secret-owner|secret-user|Requester Org/);
      assert.doesNotMatch(serialized, new RegExp(SECRET_KEY));
      return true;
    }
  );
});

test('concurrency reread resolves same-workspace primary-key conflict idempotently', async () => {
  const legacyOwnerRef = ownerRefFromApiKey('muapi-race-key');
  const repository = createFakeRepository({
    users: [{ id: 'user-owner' }],
    organizations: [{ id: 'org-1' }],
    members: [{ id: 'member-owner', userId: 'user-owner', organizationId: 'org-1', role: 'owner' }],
    conflictInsertClaim: {
      legacyOwnerRef,
      organizationId: 'org-1',
      claimedByUserId: 'user-owner',
      claimedAt: new Date('2026-01-02T00:00:00Z'),
      metadata: DYNAXIS_LEGACY_OWNER_CLAIM_METADATA,
    },
  });

  const claim = await claimLegacyOwner(
    {
      legacyApiKey: 'muapi-race-key',
      organizationId: 'org-1',
      claimedByUserId: 'user-owner',
    },
    { repository }
  );

  assert.equal(repository.state.insertAttempts, 1);
  assert.equal(repository.state.claims.length, 1);
  assert.equal(claim.legacyOwnerRef, legacyOwnerRef);
});

test('lookup services resolve claims without creating new records', async () => {
  const legacyOwnerRef = ownerRefFromApiKey('muapi-lookup-key');
  const repository = createFakeRepository({
    claims: [
      {
        legacyOwnerRef,
        organizationId: 'org-1',
        claimedByUserId: 'user-owner',
        claimedAt: new Date('2026-01-03T00:00:00Z'),
        metadata: DYNAXIS_LEGACY_OWNER_CLAIM_METADATA,
      },
    ],
  });

  assert.equal((await getLegacyOwnerRefClaim(legacyOwnerRef, { repository })).organizationId, 'org-1');
  assert.equal(await resolveOrganizationForLegacyOwnerRef(legacyOwnerRef, { repository }), 'org-1');
  assert.deepEqual(await listLegacyOwnerRefClaimsForOrganization('org-1', { repository }), [
    repository.state.claims[0],
  ]);
  assert.equal(repository.state.insertAttempts, 0);
});

test('Phase 7C.3 does not modify legacy x-api-key bridge or add public claim route', () => {
  assert.doesNotMatch(
    source('lib/dynaxis/identity/legacy-owner-claims.js'),
    /fetch\(|axios|validateProvider|providerConnection/i
  );
  assert.doesNotMatch(source('lib/dynaxis/ownership.js'), /x-dynaxis-api-key/);
  assert.throws(
    () => {
      throw new Error(source('app/api/dynaxis/claim/route.js'));
    },
    /ENOENT|Cannot find/
  );
});
