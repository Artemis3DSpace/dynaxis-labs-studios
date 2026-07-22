/**
 * Character Consumer — resolve generation-safe Character context for Studios.
 * Pure helpers + async browser resolution via platform-api client.
 *
 * Continuity: reference-based. Does NOT mutate Characters.
 */

/** Preferred roles when auto-selecting identity references (highest first). */
export const IDENTITY_ROLE_PRIORITY = [
  'identity_reference',
  'character_reference',
  'portrait_reference',
  'generated_portrait',
];

/** Roles eligible as visual video/image sources. */
export const VISUAL_SOURCE_ROLES = [
  'identity_reference',
  'character_reference',
  'portrait_reference',
  'generated_portrait',
  'style_reference',
];

/**
 * Normalise Character asset link rows from API into a flat list.
 * @param {Array} links
 */
export function normaliseCharacterAssetLinks(links = []) {
  return (links || [])
    .map((link) => {
      const asset = link.asset || link;
      const assetId = link.assetId || asset?.id || null;
      const url = asset?.url || link.url || null;
      if (!assetId && !url) return null;
      return {
        assetId,
        url,
        role: link.role || asset?.metadata?.semanticRole || 'identity_reference',
        sortOrder: link.sortOrder ?? 0,
        isPrimary: Boolean(link.isPrimary),
        type: asset?.type || 'image',
      };
    })
    .filter(Boolean)
    .filter((a) => !a.type || a.type === 'image')
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

/**
 * Deterministic reference selection for a model input budget.
 *
 * @param {ReturnType<typeof normaliseCharacterAssetLinks>} assets
 * @param {{
 *   maxImages?: number,
 *   selectedAssetIds?: string[]|null,
 *   preferredRoles?: string[],
 * }} opts
 */
export function selectCharacterReferences(assets, opts = {}) {
  const maxImages = Math.max(0, opts.maxImages ?? 1);
  const preferredRoles = opts.preferredRoles || IDENTITY_ROLE_PRIORITY;
  const selectedIds = Array.isArray(opts.selectedAssetIds)
    ? opts.selectedAssetIds.filter(Boolean)
    : null;

  const pool = normaliseCharacterAssetLinks(assets).filter(
    (a) => a.url && /^https?:\/\//i.test(a.url)
  );

  let chosen = [];
  if (selectedIds?.length) {
    const byId = new Map(pool.map((a) => [a.assetId, a]));
    for (const id of selectedIds) {
      const hit = byId.get(id);
      if (hit) chosen.push(hit);
      if (chosen.length >= maxImages) break;
    }
  }

  if (!chosen.length && maxImages > 0) {
    const ranked = [...pool].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const ra = preferredRoles.indexOf(a.role);
      const rb = preferredRoles.indexOf(b.role);
      const sa = ra === -1 ? preferredRoles.length : ra;
      const sb = rb === -1 ? preferredRoles.length : rb;
      if (sa !== sb) return sa - sb;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    chosen = ranked.slice(0, maxImages);
  }

  return {
    references: chosen.slice(0, maxImages),
    urls: chosen.slice(0, maxImages).map((r) => r.url).filter(Boolean),
    assetIds: chosen
      .slice(0, maxImages)
      .map((r) => r.assetId)
      .filter(Boolean),
    maxImages,
    truncated: pool.length > maxImages,
  };
}

/**
 * Visual-only fields for image/video generation (not chat system prompts).
 * @param {object} character
 * @param {object|null} revision
 */
export function buildVisualDescription(character, revision = null) {
  const src = revision || character || {};
  const parts = [];
  if (src.name) parts.push(String(src.name).trim());
  if (src.description) parts.push(String(src.description).trim());
  // Persona may contain appearance cues; include briefly for visual gen only
  if (src.persona) {
    const persona = String(src.persona).trim();
    if (persona.length <= 400) parts.push(persona);
    else parts.push(`${persona.slice(0, 400)}…`);
  }
  // Explicitly exclude systemPrompt / greeting / backstory dumps for video/image
  return parts.filter(Boolean).join('. ');
}

/**
 * Runtime CharacterVisualContext projection (not a DB entity).
 */
export function buildCharacterVisualContext({
  character,
  revision = null,
  assets = [],
  referenceSelection = null,
  consumer = null,
}) {
  const rev = revision || null;
  const characterId = character?.id || null;
  const characterRevisionId = rev?.id || character?.currentRevisionId || null;
  const allAssets = normaliseCharacterAssetLinks(assets);
  const selection =
    referenceSelection ||
    selectCharacterReferences(allAssets, { maxImages: 5 });

  return {
    characterId,
    characterRevisionId,
    name: character?.name || rev?.name || null,
    category: character?.category || rev?.category || null,
    visualDescription: buildVisualDescription(character, rev),
    primaryAssetId: character?.primaryAssetId || null,
    references: selection.references,
    referenceUrls: selection.urls,
    referenceAssetIds: selection.assetIds,
    allAssets,
    continuity: 'reference-based',
    consumer: consumer || null,
    pinnedRevision: Boolean(revision),
  };
}

/**
 * Resolve Character context via platform client (browser / tests).
 *
 * @param {{ getCharacter: Function, listCharacterAssets?: Function, getCharacterRevision?: Function, listCharacterRevisions?: Function, linkCharacterToProject?: Function }} client
 * @param {string} characterId
 * @param {{
 *   revisionId?: string|null,
 *   maxImages?: number,
 *   selectedAssetIds?: string[]|null,
 *   projectId?: string|null,
 *   linkToProject?: boolean,
 *   consumer?: string,
 * }} [options]
 */
export async function resolveCharacterContext(client, characterId, options = {}) {
  if (!client || typeof client.getCharacter !== 'function') {
    const err = new Error('Platform client required to resolve Character context');
    err.code = 'CHARACTER_CLIENT_REQUIRED';
    throw err;
  }
  if (!characterId) {
    const err = new Error('characterId is required');
    err.code = 'CHARACTER_ID_REQUIRED';
    throw err;
  }

  const data = await client.getCharacter(characterId, { includeAssets: 'true' });
  const character = data?.character || data;
  if (!character?.id) {
    const err = new Error('Character not found');
    err.code = 'CHARACTER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let revision = null;
  const revisionId = options.revisionId || null;
  if (revisionId && typeof client.listCharacterRevisions === 'function') {
    // Prefer dedicated get if present; otherwise scan list
    if (typeof client.getCharacterRevision === 'function') {
      const revRes = await client.getCharacterRevision(revisionId);
      revision = revRes?.revision || revRes || null;
    } else {
      const list = await client.listCharacterRevisions(characterId);
      const revisions = list?.revisions || list || [];
      revision = revisions.find((r) => r.id === revisionId) || null;
    }
    if (!revision) {
      const err = new Error('Character revision not found');
      err.code = 'CHARACTER_REVISION_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  let assets = character.assets || [];
  if ((!assets || !assets.length) && typeof client.listCharacterAssets === 'function') {
    const assetRes = await client.listCharacterAssets(characterId);
    assets = assetRes?.assets || assetRes || [];
  }

  // Snapshot assets from revision if present
  if (revision?.snapshot?.assets?.length && !options.selectedAssetIds?.length) {
    const snapIds = new Set(
      revision.snapshot.assets.map((a) => a.assetId).filter(Boolean)
    );
    if (snapIds.size) {
      assets = (assets || []).filter(
        (l) => snapIds.has(l.assetId || l.asset?.id)
      );
    }
  }

  const referenceSelection = selectCharacterReferences(assets, {
    maxImages: options.maxImages ?? 5,
    selectedAssetIds: options.selectedAssetIds || null,
  });

  if (options.linkToProject && options.projectId && typeof client.linkCharacterToProject === 'function') {
    try {
      await client.linkCharacterToProject(characterId, {
        projectId: options.projectId,
      });
    } catch {
      // non-fatal — Character remains usable
    }
  }

  const visual = buildCharacterVisualContext({
    character,
    revision,
    assets,
    referenceSelection,
    consumer: options.consumer || null,
  });

  return {
    character,
    revision: revision || {
      id: character.currentRevisionId,
      revisionNumber: null,
      impliedCurrent: true,
    },
    visual,
    provenance: {
      characterId: visual.characterId,
      characterRevisionId: visual.characterRevisionId,
      referenceAssetIds: visual.referenceAssetIds,
      continuity: 'reference-based',
    },
  };
}

/**
 * Publish Character provenance onto window for studio submitAndPoll lifecycle.
 * Optional `generationMetadata` carries Lip Sync / Studio input Asset IDs etc.
 */
export function publishCharacterGenerationContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  window.__dynaxisCharacterId = ctx.characterId || null;
  window.__dynaxisCharacterRevisionId = ctx.characterRevisionId || null;
  window.__dynaxisCharacterReferenceAssetIds = Array.isArray(ctx.referenceAssetIds)
    ? ctx.referenceAssetIds
    : null;
  window.__dynaxisGenerationMetadata =
    ctx.generationMetadata && typeof ctx.generationMetadata === 'object'
      ? { ...ctx.generationMetadata }
      : null;
  window.dispatchEvent(
    new CustomEvent('dynaxis:character-context', {
      detail: {
        characterId: window.__dynaxisCharacterId,
        characterRevisionId: window.__dynaxisCharacterRevisionId,
        referenceAssetIds: window.__dynaxisCharacterReferenceAssetIds,
        generationMetadata: window.__dynaxisGenerationMetadata,
      },
    })
  );
}

export function clearCharacterGenerationContext() {
  publishCharacterGenerationContext({});
}

export function readCharacterGenerationContext() {
  if (typeof window === 'undefined') {
    return {
      characterId: null,
      characterRevisionId: null,
      referenceAssetIds: null,
      generationMetadata: null,
    };
  }
  return {
    characterId: window.__dynaxisCharacterId || null,
    characterRevisionId: window.__dynaxisCharacterRevisionId || null,
    referenceAssetIds: window.__dynaxisCharacterReferenceAssetIds || null,
    generationMetadata: window.__dynaxisGenerationMetadata || null,
  };
}
