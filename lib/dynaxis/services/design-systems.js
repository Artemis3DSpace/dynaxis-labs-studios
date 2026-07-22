/**
 * Dynaxis Design System service — token collections, modes, Brand seed (server-only).
 */

import 'server-only';
import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { DESIGN_SYSTEM_STATUSES } from '../types.js';
import { parseDesignTokenDocument, emptyDesignTokenDocument } from '../design-systems/document.js';
import { evaluateDesignSystemRevisionUpdate as evaluateTokenDocumentRevisionUpdate } from '../design-systems/resolver.js';
import { seedTokenDocumentFromBrandVisual } from '../design-systems/seed-from-brand.js';
import { collectDocumentTokenIds } from '../design-systems/bindings.js';
import { buildBrandVisualContext } from '../brands/consumer.js';

function notFound(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 404;
  return err;
}

function badRequest(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 400;
  return err;
}

export const createDesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['draft', 'active']).default('draft'),
  document: z.unknown().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createDesignSystemFromBrandSchema = z.object({
  brandId: z.string().uuid(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const createDesignSystemRevisionSchema = z.object({
  document: z.unknown(),
  reason: z.string().trim().max(500).optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  activate: z.boolean().default(true),
  brandRevisionId: z.string().uuid().optional().nullable(),
});

async function requireDesignSystem(store, ownerRef, id) {
  const row = await store.getDesignSystem(ownerRef, id);
  if (!row || row.archivedAt) throw notFound('DESIGN_SYSTEM_NOT_FOUND', 'Design System not found');
  return row;
}

export async function listDesignSystems(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const designSystems = await store.listDesignSystems(ownerRef, opts);
  return { designSystems };
}

export async function getDesignSystem(ownerRef, id) {
  const store = await getPlatformStore();
  const designSystem = await requireDesignSystem(store, ownerRef, id);
  const revisions = await store.listDesignSystemRevisions(ownerRef, id);
  return { designSystem, revisions };
}

export async function createDesignSystem(ownerRef, input) {
  const data = createDesignSystemSchema.parse(input);
  const store = await getPlatformStore();
  const document = parseDesignTokenDocument(data.document || emptyDesignTokenDocument());
  validateDesignTokenDocumentAssets(document);

  if (data.brandId) {
    const brand = await store.getBrand(ownerRef, data.brandId);
    if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  }

  const designSystem = await store.createDesignSystem({
    ownerRef,
    name: data.name,
    description: data.description ?? null,
    status: data.status,
    brandId: data.brandId ?? null,
    brandRevisionId: data.brandRevisionId ?? null,
    metadata: data.metadata || {},
  });

  const revision = await store.createDesignSystemRevision({
    designSystemId: designSystem.id,
    ownerRef,
    document,
    brandRevisionId: data.brandRevisionId ?? null,
    label: 'v1',
    reason: 'initial',
  });

  const updated = await store.updateDesignSystem(ownerRef, designSystem.id, {
    currentRevisionId: revision.id,
  });

  return { designSystem: updated, revision };
}

export async function createDesignSystemFromBrand(ownerRef, input) {
  const data = createDesignSystemFromBrandSchema.parse(input);
  const store = await getPlatformStore();
  const brand = await store.getBrand(ownerRef, data.brandId);
  if (!brand || brand.archivedAt) throw notFound('BRAND_NOT_FOUND', 'Brand not found');

  const brandRevisionId = data.brandRevisionId || brand.currentRevisionId;
  let revision = null;
  if (brandRevisionId) {
    revision = await store.getBrandRevision(ownerRef, brandRevisionId);
  }
  const brandAssets =
    typeof store.listBrandAssets === 'function' ? await store.listBrandAssets(brand.id) : [];
  const visual = buildBrandVisualContext(brand, revision, brandAssets);
  const document = seedTokenDocumentFromBrandVisual(visual || {
    primaryColors: brand.primaryColors || [],
    secondaryColors: brand.secondaryColors || [],
    fonts: brand.fonts || [],
  });

  return createDesignSystem(ownerRef, {
    name: data.name || `${brand.name} Design System`,
    description:
      data.description ||
      `Seeded from Brand "${brand.name}" (copy — not live-synced)`,
    status: 'draft',
    document,
    brandId: brand.id,
    brandRevisionId: brandRevisionId || null,
    metadata: {
      seededFromBrand: true,
      sourceBrandRevisionId: brandRevisionId || null,
    },
  });
}

export async function createDesignSystemRevision(ownerRef, designSystemId, input) {
  const data = createDesignSystemRevisionSchema.parse(input);
  const store = await getPlatformStore();
  const designSystem = await requireDesignSystem(store, ownerRef, designSystemId);
  const document = parseDesignTokenDocument(data.document);
  validateDesignTokenDocumentAssets(document);

  const revision = await store.createDesignSystemRevision({
    designSystemId: designSystem.id,
    ownerRef,
    document,
    brandRevisionId: data.brandRevisionId ?? designSystem.brandRevisionId ?? null,
    reason: data.reason ?? null,
    label: data.label ?? null,
  });

  let updated = designSystem;
  if (data.activate) {
    updated = await store.updateDesignSystem(ownerRef, designSystem.id, {
      currentRevisionId: revision.id,
      status: designSystem.status === 'archived' ? designSystem.status : 'active',
    });
  }

  return { designSystem: updated, revision };
}

export async function updateDesignSystem(ownerRef, id, input) {
  const schema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['draft', 'active']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  });
  const data = schema.parse(input);
  const store = await getPlatformStore();
  await requireDesignSystem(store, ownerRef, id);
  const designSystem = await store.updateDesignSystem(ownerRef, id, data);
  return { designSystem };
}

export async function archiveDesignSystem(ownerRef, id) {
  const store = await getPlatformStore();
  await requireDesignSystem(store, ownerRef, id);
  const designSystem = await store.archiveDesignSystem(ownerRef, id);
  return { designSystem };
}

export async function getDesignSystemRevision(ownerRef, revisionId) {
  const store = await getPlatformStore();
  const revision = await store.getDesignSystemRevision(ownerRef, revisionId);
  if (!revision) throw notFound('DESIGN_SYSTEM_REVISION_NOT_FOUND', 'Design System revision not found');
  return { revision };
}

export async function loadDesignSystemRevisionDocument(ownerRef, revisionId) {
  const store = await getPlatformStore();
  if (!revisionId) return null;
  return store.getDesignSystemRevision(ownerRef, revisionId);
}

/**
 * Evaluate Design System revision update against token IDs used by a Composition Document.
 */
export async function evaluateCompositionDesignSystemUpdate(
  ownerRef,
  { compositionDocument, currentRevisionId, targetRevisionId }
) {
  const store = await getPlatformStore();
  const current = await store.getDesignSystemRevision(ownerRef, currentRevisionId);
  const target = await store.getDesignSystemRevision(ownerRef, targetRevisionId);
  if (!current || !target) {
    throw notFound('DESIGN_SYSTEM_REVISION_NOT_FOUND', 'Design System revision not found');
  }
  if (current.designSystemId !== target.designSystemId) {
    throw badRequest('DESIGN_SYSTEM_REVISION_MISMATCH', 'Revisions belong to different Design Systems');
  }
  const usedTokenIds = collectDocumentTokenIds(compositionDocument || {});
  const evaluation = evaluateTokenDocumentRevisionUpdate(
    current.document,
    target.document,
    usedTokenIds
  );
  return {
    currentRevisionId,
    targetRevisionId,
    usedTokenIds,
    ...evaluation,
  };
}

/** Alias matching Phase 6I naming — evaluates used token IDs across revisions. */
export async function evaluateDesignSystemRevisionUpdateForComposition(ownerRef, input) {
  return evaluateCompositionDesignSystemUpdate(ownerRef, input);
}

/**
 * Token documents do not reference Assets yet — reserved for future image/font assets.
 * @returns {{ ok: true, errors: [] }}
 */
export function validateDesignTokenDocumentAssets(_document) {
  return { ok: true, errors: [] };
}

export {
  DESIGN_SYSTEM_STATUSES,
  parseDesignTokenDocument,
  collectDocumentTokenIds,
  evaluateTokenDocumentRevisionUpdate as evaluateDesignSystemRevisionUpdate,
};
