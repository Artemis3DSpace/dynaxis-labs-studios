/**
 * Canonical Dynaxis Workspace ownership boundary.
 *
 * Phase 7C.4 keeps owner_ref compatibility while projecting nullable
 * organization_id onto workspace-owned root resources.
 */

import 'server-only';
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { getDb, isMemoryDriverAllowed } from '../db/client.js';
import {
  dynaxisBrands,
  dynaxisCharacters,
  dynaxisDesignComponentSets,
  dynaxisDesignComponents,
  dynaxisDesignSystems,
  dynaxisDesignTemplates,
  dynaxisProducts,
  dynaxisProjects,
} from '../db/schema.js';
import { LOCAL_PREVIEW_KEY, ownerRefFromApiKey } from '../ownership.js';
import { dynaxisOwnerRefClaims } from './schema.js';

export const DYNAXIS_WORKSPACE_OWNED_ROOTS = Object.freeze({
  project: Object.freeze({
    tableName: 'dynaxis_projects',
    table: dynaxisProjects,
    organizationIndex: 'dynaxis_projects_organization_idx',
  }),
  character: Object.freeze({
    tableName: 'dynaxis_characters',
    table: dynaxisCharacters,
    organizationIndex: 'dynaxis_characters_organization_idx',
  }),
  product: Object.freeze({
    tableName: 'dynaxis_products',
    table: dynaxisProducts,
    organizationIndex: 'dynaxis_products_organization_idx',
  }),
  brand: Object.freeze({
    tableName: 'dynaxis_brands',
    table: dynaxisBrands,
    organizationIndex: 'dynaxis_brands_organization_idx',
  }),
  designTemplate: Object.freeze({
    tableName: 'dynaxis_design_templates',
    table: dynaxisDesignTemplates,
    organizationIndex: 'dynaxis_design_templates_organization_idx',
  }),
  designComponent: Object.freeze({
    tableName: 'dynaxis_design_components',
    table: dynaxisDesignComponents,
    organizationIndex: 'dynaxis_design_components_organization_idx',
  }),
  designSystem: Object.freeze({
    tableName: 'dynaxis_design_systems',
    table: dynaxisDesignSystems,
    organizationIndex: 'dynaxis_design_systems_organization_idx',
  }),
  designComponentSet: Object.freeze({
    tableName: 'dynaxis_design_component_sets',
    table: dynaxisDesignComponentSets,
    organizationIndex: 'dynaxis_design_component_sets_organization_idx',
  }),
});

export const DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES = Object.freeze({
  REQUIRED_INPUT: 'DYNAXIS_WORKSPACE_OWNERSHIP_REQUIRED_INPUT',
  CONFLICT: 'DYNAXIS_WORKSPACE_OWNERSHIP_CONFLICT',
});

const PREVIEW_OWNER_REF = ownerRefFromApiKey(LOCAL_PREVIEW_KEY);

export class DynaxisWorkspaceOwnershipError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'DynaxisWorkspaceOwnershipError';
    this.code = opts.code || DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.REQUIRED_INPUT;
    this.status = opts.status || 400;
  }
}

function ownershipError(code, status, message) {
  return new DynaxisWorkspaceOwnershipError(message, { code, status });
}

function requireString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw ownershipError(
      DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.REQUIRED_INPUT,
      400,
      `${label} is required`
    );
  }
  return normalized;
}

function rootEntries() {
  return Object.entries(DYNAXIS_WORKSPACE_OWNED_ROOTS);
}

export function isCanonicalPersistentOwnerRef(ownerRef) {
  const normalized = String(ownerRef || '').trim();
  return Boolean(normalized) && normalized !== PREVIEW_OWNER_REF;
}

export function createDrizzleWorkspaceOwnershipRepository(db = getDb()) {
  return {
    async findClaim(legacyOwnerRef) {
      const rows = await db
        .select()
        .from(dynaxisOwnerRefClaims)
        .where(eq(dynaxisOwnerRefClaims.legacyOwnerRef, legacyOwnerRef))
        .limit(1);
      return rows[0] || null;
    },
    async findProject(projectId) {
      const rows = await db
        .select()
        .from(dynaxisProjects)
        .where(eq(dynaxisProjects.id, projectId))
        .limit(1);
      return rows[0] || null;
    },
    async findOwnershipConflicts({ legacyOwnerRef, organizationId }) {
      const conflicts = [];
      for (const [root, descriptor] of rootEntries()) {
        const table = descriptor.table;
        const rows = await db
          .select({ id: table.id, organizationId: table.organizationId })
          .from(table)
          .where(
            and(
              eq(table.ownerRef, legacyOwnerRef),
              isNotNull(table.organizationId),
              ne(table.organizationId, organizationId)
            )
          )
          .limit(1);
        if (rows.length) {
          conflicts.push({ root, tableName: descriptor.tableName, resourceId: rows[0].id });
        }
      }
      return conflicts;
    },
    async projectRootOwnership({ legacyOwnerRef, organizationId }) {
      const counts = {};
      for (const [root, descriptor] of rootEntries()) {
        const table = descriptor.table;
        const rows = await db
          .update(table)
          .set({ organizationId, updatedAt: new Date() })
          .where(and(eq(table.ownerRef, legacyOwnerRef), isNull(table.organizationId)))
          .returning({ id: table.id });
        counts[root] = rows.length;
      }
      return counts;
    },
  };
}

export async function resolveOrganizationIdForLegacyOwnerRef(
  ownerRef,
  { repository = null } = {}
) {
  const legacyOwnerRef = requireString(ownerRef, 'ownerRef');
  if (!isCanonicalPersistentOwnerRef(legacyOwnerRef)) {
    return null;
  }
  if (!repository && isMemoryDriverAllowed()) {
    return null;
  }
  const repo = repository || createDrizzleWorkspaceOwnershipRepository();
  const claim = await repo.findClaim(legacyOwnerRef);
  return claim?.organizationId || null;
}

export async function resolveCanonicalResourceOrganization(
  { organizationId = null, ownerRef = null },
  { repository = null } = {}
) {
  const directOrganizationId = String(organizationId || '').trim();
  const claimedOrganizationId = ownerRef
    ? await resolveOrganizationIdForLegacyOwnerRef(ownerRef, { repository })
    : null;

  if (directOrganizationId) {
    if (claimedOrganizationId && claimedOrganizationId !== directOrganizationId) {
      throw ownershipError(
        DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.CONFLICT,
        409,
        'Workspace ownership conflict'
      );
    }
    return directOrganizationId;
  }

  return claimedOrganizationId;
}

export async function resolveWorkspaceOrganizationForLegacyWrite(
  ownerRef,
  opts = {}
) {
  return resolveCanonicalResourceOrganization({ ownerRef }, opts);
}

export async function projectWorkspaceOwnershipForLegacyOwnerRef(
  { legacyOwnerRef, organizationId },
  { repository = null } = {}
) {
  const ownerRef = requireString(legacyOwnerRef, 'legacyOwnerRef');
  const targetOrganizationId = requireString(organizationId, 'organizationId');
  if (!isCanonicalPersistentOwnerRef(ownerRef)) {
    return { projected: false, counts: {} };
  }
  const repo = repository || createDrizzleWorkspaceOwnershipRepository();

  const conflicts = await repo.findOwnershipConflicts({
    legacyOwnerRef: ownerRef,
    organizationId: targetOrganizationId,
  });
  if (conflicts.length) {
    throw ownershipError(
      DYNAXIS_WORKSPACE_OWNERSHIP_ERROR_CODES.CONFLICT,
      409,
      'Workspace ownership conflict'
    );
  }

  const counts = await repo.projectRootOwnership({
    legacyOwnerRef: ownerRef,
    organizationId: targetOrganizationId,
  });
  return { projected: true, counts };
}

export async function resolveProjectOrganization(
  projectId,
  { repository = null } = {}
) {
  const id = requireString(projectId, 'projectId');
  if (!repository && isMemoryDriverAllowed()) {
    return null;
  }
  const repo = repository || createDrizzleWorkspaceOwnershipRepository();
  const project = await repo.findProject(id);
  if (!project) {
    return null;
  }
  return resolveCanonicalResourceOrganization(
    {
      organizationId: project.organizationId,
      ownerRef: project.ownerRef,
    },
    { repository: repo }
  );
}
