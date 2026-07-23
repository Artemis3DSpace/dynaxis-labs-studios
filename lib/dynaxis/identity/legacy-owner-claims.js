/**
 * Legacy ownerRef claim bridge.
 *
 * Phase 7C.3 creates a durable one-way claim from historical MuAPI-key-derived
 * ownerRefs to Dynaxis Workspaces. It does not migrate resources or expose a
 * public claim route.
 */

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { member, organization, user } from '../auth/schema.js';
import { canClaimLegacyOwnerRef } from '../auth/workspace-access.js';
import { LOCAL_PREVIEW_KEY, ownerRefFromApiKey } from '../ownership.js';
import { dynaxisOwnerRefClaims } from './schema.js';

export const DYNAXIS_LEGACY_OWNER_CLAIM_METADATA = Object.freeze({
  version: 1,
  method: 'legacy-api-key',
});

export const DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES = Object.freeze({
  REQUIRED_INPUT: 'DYNAXIS_LEGACY_OWNER_CLAIM_REQUIRED_INPUT',
  USER_NOT_FOUND: 'DYNAXIS_LEGACY_OWNER_CLAIM_USER_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'DYNAXIS_LEGACY_OWNER_CLAIM_ORGANIZATION_NOT_FOUND',
  FORBIDDEN: 'DYNAXIS_LEGACY_OWNER_CLAIM_FORBIDDEN',
  PREVIEW_NOT_ALLOWED: 'DYNAXIS_LEGACY_OWNER_CLAIM_PREVIEW_NOT_ALLOWED',
  CONFLICT: 'DYNAXIS_LEGACY_OWNER_CLAIM_CONFLICT',
});

const PREVIEW_OWNER_REF = ownerRefFromApiKey(LOCAL_PREVIEW_KEY);

export class DynaxisLegacyOwnerClaimError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'DynaxisLegacyOwnerClaimError';
    this.code = opts.code || DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT;
    this.status = opts.status || 400;
  }
}

function legacyClaimError(code, status, message) {
  return new DynaxisLegacyOwnerClaimError(message, { code, status });
}

function requireString(value, code, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw legacyClaimError(code, 400, `${label} is required`);
  }
  return normalized;
}

export function isPreviewLegacyOwnerRef(legacyOwnerRef) {
  return String(legacyOwnerRef || '').trim() === PREVIEW_OWNER_REF;
}

export function deriveClaimableLegacyOwnerRef(legacyApiKey) {
  const key = requireString(
    legacyApiKey,
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT,
    'legacyApiKey'
  );
  if (key === LOCAL_PREVIEW_KEY || key === PREVIEW_OWNER_REF) {
    throw legacyClaimError(
      DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.PREVIEW_NOT_ALLOWED,
      400,
      'Local preview ownership cannot be claimed'
    );
  }

  const legacyOwnerRef = ownerRefFromApiKey(key);
  if (isPreviewLegacyOwnerRef(legacyOwnerRef)) {
    throw legacyClaimError(
      DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.PREVIEW_NOT_ALLOWED,
      400,
      'Local preview ownership cannot be claimed'
    );
  }
  return legacyOwnerRef;
}

export function createDrizzleLegacyOwnerClaimRepository(db = getDb()) {
  return {
    transaction(callback) {
      return db.transaction((tx) => callback(createDrizzleLegacyOwnerClaimRepository(tx)));
    },
    async findUserById(userId) {
      const rows = await db.select().from(user).where(eq(user.id, userId)).limit(1);
      return rows[0] || null;
    },
    async findOrganizationById(organizationId) {
      const rows = await db
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      return rows[0] || null;
    },
    async findMembership({ organizationId, userId }) {
      const rows = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
        .limit(1);
      return rows[0] || null;
    },
    async findClaim(legacyOwnerRef) {
      const rows = await db
        .select()
        .from(dynaxisOwnerRefClaims)
        .where(eq(dynaxisOwnerRefClaims.legacyOwnerRef, legacyOwnerRef))
        .limit(1);
      return rows[0] || null;
    },
    async insertClaim(claim) {
      const rows = await db
        .insert(dynaxisOwnerRefClaims)
        .values(claim)
        .onConflictDoNothing({ target: dynaxisOwnerRefClaims.legacyOwnerRef })
        .returning();
      return rows[0] || null;
    },
    async listClaimsForOrganization(organizationId) {
      return db
        .select()
        .from(dynaxisOwnerRefClaims)
        .where(eq(dynaxisOwnerRefClaims.organizationId, organizationId));
    },
  };
}

async function requireClaimAuthority(repository, { organizationId, claimedByUserId }) {
  const [claimingUser, targetOrganization, membership] = await Promise.all([
    repository.findUserById(claimedByUserId),
    repository.findOrganizationById(organizationId),
    repository.findMembership({ organizationId, userId: claimedByUserId }),
  ]);

  if (!claimingUser) {
    throw legacyClaimError(
      DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.USER_NOT_FOUND,
      404,
      'Claiming user was not found'
    );
  }
  if (!targetOrganization) {
    throw legacyClaimError(
      DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.ORGANIZATION_NOT_FOUND,
      404,
      'Organization was not found'
    );
  }
  if (!membership || !canClaimLegacyOwnerRef(membership.role)) {
    throw legacyClaimError(
      DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.FORBIDDEN,
      403,
      'Workspace owner or admin role is required to claim legacy ownership'
    );
  }
}

function assertClaimConflictSafe(existingClaim, organizationId) {
  if (!existingClaim) {
    return;
  }
  if (existingClaim.organizationId === organizationId) {
    return;
  }
  throw legacyClaimError(
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.CONFLICT,
    409,
    'Legacy ownership has already been claimed'
  );
}

export async function claimLegacyOwner(
  { legacyApiKey, organizationId, claimedByUserId },
  { repository = createDrizzleLegacyOwnerClaimRepository() } = {}
) {
  const targetOrganizationId = requireString(
    organizationId,
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT,
    'organizationId'
  );
  const claimantUserId = requireString(
    claimedByUserId,
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT,
    'claimedByUserId'
  );
  const legacyOwnerRef = deriveClaimableLegacyOwnerRef(legacyApiKey);

  return repository.transaction(async (tx) => {
    await requireClaimAuthority(tx, {
      organizationId: targetOrganizationId,
      claimedByUserId: claimantUserId,
    });

    const existing = await tx.findClaim(legacyOwnerRef);
    assertClaimConflictSafe(existing, targetOrganizationId);
    if (existing) {
      return existing;
    }

    const inserted = await tx.insertClaim({
      legacyOwnerRef,
      organizationId: targetOrganizationId,
      claimedByUserId: claimantUserId,
      claimedAt: new Date(),
      metadata: { ...DYNAXIS_LEGACY_OWNER_CLAIM_METADATA },
    });
    if (inserted) {
      return inserted;
    }

    const reread = await tx.findClaim(legacyOwnerRef);
    assertClaimConflictSafe(reread, targetOrganizationId);
    return reread;
  });
}

export async function getLegacyOwnerRefClaim(
  legacyOwnerRef,
  { repository = createDrizzleLegacyOwnerClaimRepository() } = {}
) {
  const ownerRef = requireString(
    legacyOwnerRef,
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT,
    'legacyOwnerRef'
  );
  if (isPreviewLegacyOwnerRef(ownerRef)) {
    return null;
  }
  return repository.findClaim(ownerRef);
}

export async function resolveOrganizationForLegacyOwnerRef(
  legacyOwnerRef,
  { repository = createDrizzleLegacyOwnerClaimRepository() } = {}
) {
  const claim = await getLegacyOwnerRefClaim(legacyOwnerRef, { repository });
  return claim?.organizationId || null;
}

export async function listLegacyOwnerRefClaimsForOrganization(
  organizationId,
  { repository = createDrizzleLegacyOwnerClaimRepository() } = {}
) {
  const targetOrganizationId = requireString(
    organizationId,
    DYNAXIS_LEGACY_OWNER_CLAIM_ERROR_CODES.REQUIRED_INPUT,
    'organizationId'
  );
  return repository.listClaimsForOrganization(targetOrganizationId);
}
