/**
 * Brand Consumer — generation-safe Brand context for Studios.
 * Pure helpers + async browser resolution via platform-api client.
 */

import { normaliseProductAssetLinks } from '../products/consumer.js';

/** Prefer logos for visual Brand references. */
export const BRAND_LOGO_ROLE_PRIORITY = [
  'primary_logo',
  'wordmark',
  'brand_mark',
  'alternate_logo',
  'brand_reference',
];

/**
 * @param {Array} links
 */
export function normaliseBrandAssetLinks(links = []) {
  return normaliseProductAssetLinks(links).map((a) => ({
    ...a,
    role: a.role || 'brand_reference',
  }));
}

/**
 * @param {object} brand
 * @param {object|null} revision
 */
export function buildBrandMessagingContext(brand, revision = null) {
  const src = revision?.snapshot || revision || brand || {};
  return {
    brandId: brand?.id || null,
    brandRevisionId: revision?.id || brand?.currentRevisionId || null,
    name: src.name || brand?.name || null,
    industry: src.industry ?? brand?.industry ?? null,
    tagline: src.tagline ?? brand?.tagline ?? null,
    valueProposition: src.valueProposition ?? brand?.valueProposition ?? null,
    targetAudience: src.targetAudience ?? brand?.targetAudience ?? null,
    toneOfVoice: src.toneOfVoice || brand?.toneOfVoice || [],
    brandPersonality: src.brandPersonality || brand?.brandPersonality || [],
    keyMessages: src.keyMessages || brand?.keyMessages || [],
  };
}

/**
 * @param {object} brand
 * @param {object|null} revision
 * @param {Array} assets
 */
export function buildBrandVisualContext(brand, revision = null, assets = []) {
  const src = revision?.snapshot || revision || brand || {};
  const allAssets = normaliseBrandAssetLinks(assets);
  const logos = [...allAssets]
    .filter((a) => a.url)
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const ra = BRAND_LOGO_ROLE_PRIORITY.indexOf(a.role);
      const rb = BRAND_LOGO_ROLE_PRIORITY.indexOf(b.role);
      const sa = ra === -1 ? BRAND_LOGO_ROLE_PRIORITY.length : ra;
      const sb = rb === -1 ? BRAND_LOGO_ROLE_PRIORITY.length : rb;
      return sa - sb;
    });

  return {
    brandId: brand?.id || null,
    brandRevisionId: revision?.id || brand?.currentRevisionId || null,
    name: src.name || brand?.name || null,
    primaryColors: src.primaryColors || brand?.primaryColors || [],
    secondaryColors: src.secondaryColors || brand?.secondaryColors || [],
    fonts: src.fonts || brand?.fonts || [],
    imageryStyle: src.imageryStyle ?? brand?.imageryStyle ?? null,
    layoutStyle: src.layoutStyle ?? brand?.layoutStyle ?? null,
    logo: logos[0] || null,
    logoUrl: logos[0]?.url || null,
    logoAssetId: logos[0]?.assetId || null,
    references: logos.slice(0, 3),
    allAssets,
  };
}

/**
 * @param {object} brand
 * @param {object|null} revision
 * @param {Array} assets
 */
export function buildBrandContext(brand, revision = null, assets = []) {
  return {
    brand,
    revision: revision || {
      id: brand?.currentRevisionId,
      impliedCurrent: true,
    },
    messaging: buildBrandMessagingContext(brand, revision),
    visual: buildBrandVisualContext(brand, revision, assets),
    provenance: {
      brandId: brand?.id || null,
      brandRevisionId: revision?.id || brand?.currentRevisionId || null,
      continuity: 'reference-based',
    },
  };
}

/**
 * @param {{ getBrand: Function, listBrandAssets?: Function, listBrandRevisions?: Function, linkBrandToProject?: Function }} client
 * @param {string} brandId
 * @param {object} [options]
 */
export async function resolveBrandContext(client, brandId, options = {}) {
  if (!client || typeof client.getBrand !== 'function') {
    const err = new Error('Platform client required to resolve Brand context');
    err.code = 'BRAND_CLIENT_REQUIRED';
    throw err;
  }
  if (!brandId) {
    const err = new Error('brandId is required');
    err.code = 'BRAND_ID_REQUIRED';
    throw err;
  }

  const data = await client.getBrand(brandId, { includeAssets: 'true' });
  const brand = data?.brand || data;
  if (!brand?.id) {
    const err = new Error('Brand not found');
    err.code = 'BRAND_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let revision = null;
  if (options.revisionId && typeof client.listBrandRevisions === 'function') {
    const list = await client.listBrandRevisions(brandId);
    const revisions = list?.revisions || list || [];
    revision = revisions.find((r) => r.id === options.revisionId) || null;
    if (!revision) {
      const err = new Error('Brand revision not found');
      err.code = 'BRAND_REVISION_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  let assets = brand.assets || data?.assets || [];
  if ((!assets || !assets.length) && typeof client.listBrandAssets === 'function') {
    const assetRes = await client.listBrandAssets(brandId);
    assets = assetRes?.assets || assetRes || [];
  }

  if (options.linkToProject && options.projectId && typeof client.linkBrandToProject === 'function') {
    try {
      await client.linkBrandToProject(brandId, { projectId: options.projectId });
    } catch {
      // non-fatal
    }
  }

  return buildBrandContext(brand, revision, assets);
}

export function publishBrandGenerationContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  window.__dynaxisBrandId = ctx.brandId || null;
  window.__dynaxisBrandRevisionId = ctx.brandRevisionId || null;
  window.__dynaxisBrandLogoAssetId = ctx.logoAssetId || null;
  if (ctx.generationMetadata && typeof ctx.generationMetadata === 'object') {
    window.__dynaxisGenerationMetadata = {
      ...(window.__dynaxisGenerationMetadata &&
      typeof window.__dynaxisGenerationMetadata === 'object'
        ? window.__dynaxisGenerationMetadata
        : {}),
      ...ctx.generationMetadata,
      brandId: ctx.brandId || null,
      brandRevisionId: ctx.brandRevisionId || null,
    };
  }
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('dynaxis:brand-context', {
        detail: {
          brandId: window.__dynaxisBrandId,
          brandRevisionId: window.__dynaxisBrandRevisionId,
          logoAssetId: window.__dynaxisBrandLogoAssetId,
        },
      })
    );
  }
}

export function clearBrandGenerationContext() {
  if (typeof window === 'undefined') return;
  window.__dynaxisBrandId = null;
  window.__dynaxisBrandRevisionId = null;
  window.__dynaxisBrandLogoAssetId = null;
}

export function readBrandGenerationContext() {
  if (typeof window === 'undefined') {
    return { brandId: null, brandRevisionId: null, logoAssetId: null };
  }
  return {
    brandId: window.__dynaxisBrandId || null,
    brandRevisionId: window.__dynaxisBrandRevisionId || null,
    logoAssetId: window.__dynaxisBrandLogoAssetId || null,
  };
}

/**
 * Concise messaging guidance for Marketing prompts (does not replace user script).
 */
export function buildBrandMessagingSupplement(messaging) {
  if (!messaging) return '';
  const parts = [];
  if (messaging.tagline) parts.push(`Brand tagline: ${messaging.tagline}`);
  if (messaging.valueProposition) parts.push(`Value: ${messaging.valueProposition}`);
  if (messaging.toneOfVoice?.length) {
    parts.push(`Tone: ${messaging.toneOfVoice.slice(0, 5).join(', ')}`);
  }
  if (messaging.targetAudience) parts.push(`Audience: ${messaging.targetAudience}`);
  if (messaging.keyMessages?.length) {
    parts.push(`Key messages: ${messaging.keyMessages.slice(0, 3).join('; ')}`);
  }
  return parts.join('. ');
}
