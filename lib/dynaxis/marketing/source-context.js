/**
 * Marketing Studio source-context helpers (Phase 6B).
 * Pure / client-safe — no server modules, no secrets.
 *
 * Product / Character identities are optional. Manual uploads and avatar presets
 * remain first-class. Marketing styling stays on Generation parameters.
 */

import {
  selectProductReferences,
  normaliseProductAssetLinks,
  buildProductVisualDescription,
  publishProductGenerationContext,
  clearProductGenerationContext,
} from '../products/consumer.js';
import {
  selectCharacterReferences,
  buildVisualDescription,
  publishCharacterGenerationContext,
  clearCharacterGenerationContext,
} from '../characters/consumer.js';
import {
  buildBrandMessagingSupplement,
  publishBrandGenerationContext,
  clearBrandGenerationContext,
} from '../brands/consumer.js';

/** Verified MuAPI Seedance VIP omni-reference image budget. */
export const MARKETING_MAX_IMAGES = 9;

/** UI soft-cap for additional creative refs (legacy Marketing Studio). */
export const MARKETING_MAX_ADDITIONAL = 6;

export const MARKETING_ENDPOINTS = {
  '720p': 'seedance-2-vip-omni-reference',
  '1080p': 'sd-2-vip-omni-reference-1080p',
};

export const MARKETING_PRODUCT_ROLES = [
  'product_reference',
  'transparent_product_reference',
  'packaging_reference',
  'label_reference',
  'detail_reference',
  'generated_product_scene',
];

/**
 * @param {string} [resolution]
 */
export function getMarketingModelCapability(resolution = '1080p') {
  const res = String(resolution || '1080p');
  return {
    maxImages: MARKETING_MAX_IMAGES,
    maxAdditional: MARKETING_MAX_ADDITIONAL,
    maxVideos: 1,
    endpoint: MARKETING_ENDPOINTS[res] || MARKETING_ENDPOINTS['720p'],
    resolution: res,
  };
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Product image source precedence (explicit, non-silent):
 * upload > project Asset > persistent Product references.
 *
 * @param {{
 *   uploadedUrl?: string|null,
 *   asset?: { id?: string, url?: string }|null,
 *   productReferences?: Array<{ assetId?: string, url?: string, role?: string }>,
 * }} inputs
 */
export function resolveProductImageSource(inputs = {}) {
  if (inputs.uploadedUrl && /^https?:\/\//i.test(inputs.uploadedUrl)) {
    return {
      kind: 'upload',
      urls: [inputs.uploadedUrl],
      assetIds: [],
      productReferenceAssetIds: [],
    };
  }
  if (inputs.asset?.url && /^https?:\/\//i.test(inputs.asset.url)) {
    return {
      kind: 'asset',
      urls: [inputs.asset.url],
      assetIds: inputs.asset.id ? [inputs.asset.id] : [],
      productReferenceAssetIds: [],
    };
  }
  const refs = (inputs.productReferences || []).filter(
    (r) => r?.url && /^https?:\/\//i.test(r.url)
  );
  if (refs.length) {
    return {
      kind: 'product',
      urls: refs.map((r) => r.url),
      assetIds: refs.map((r) => r.assetId).filter(Boolean),
      productReferenceAssetIds: refs.map((r) => r.assetId).filter(Boolean),
    };
  }
  return {
    kind: 'none',
    urls: [],
    assetIds: [],
    productReferenceAssetIds: [],
  };
}

/**
 * Avatar source precedence (one active identity):
 * upload > project Asset > Character reference > predefined preset.
 *
 * @param {{
 *   uploadedUrl?: string|null,
 *   asset?: { id?: string, url?: string }|null,
 *   characterReference?: { assetId?: string, url?: string, role?: string }|null,
 *   preset?: { id?: string, name?: string, url?: string }|null,
 * }} inputs
 */
export function resolveAvatarImageSource(inputs = {}) {
  if (inputs.uploadedUrl && /^https?:\/\//i.test(inputs.uploadedUrl)) {
    return {
      kind: 'upload',
      url: inputs.uploadedUrl,
      assetId: null,
      characterReferenceAssetId: null,
      preset: null,
    };
  }
  if (inputs.asset?.url && /^https?:\/\//i.test(inputs.asset.url)) {
    return {
      kind: 'asset',
      url: inputs.asset.url,
      assetId: inputs.asset.id || null,
      characterReferenceAssetId: null,
      preset: null,
    };
  }
  if (inputs.characterReference?.url && /^https?:\/\//i.test(inputs.characterReference.url)) {
    return {
      kind: 'character',
      url: inputs.characterReference.url,
      assetId: inputs.characterReference.assetId || null,
      characterReferenceAssetId: inputs.characterReference.assetId || null,
      preset: null,
    };
  }
  if (inputs.preset?.url && /^https?:\/\//i.test(inputs.preset.url)) {
    return {
      kind: 'preset',
      url: inputs.preset.url,
      assetId: null,
      characterReferenceAssetId: null,
      preset: {
        id: inputs.preset.id || null,
        name: inputs.preset.name || null,
        url: inputs.preset.url,
      },
    };
  }
  return {
    kind: 'none',
    url: null,
    assetId: null,
    characterReferenceAssetId: null,
    preset: null,
  };
}

/**
 * Deterministic image order for Seedance @imageN:
 * 1. primary Product reference
 * 2. additional Product references
 * 3. Character/avatar reference
 * 4. Brand logo / visual reference (optional, user-selected)
 * 5. additional creative references
 *
 * Deduplicates by URL (first wins).
 *
 * @param {{
 *   productUrls?: string[],
 *   avatarUrl?: string|null,
 *   brandLogoUrl?: string|null,
 *   additionalUrls?: string[],
 * }} parts
 * @returns {{ urls: string[], slots: Array<{ role: string, url: string }> }}
 */
export function buildOrderedImageList(parts = {}) {
  const slots = [];
  const seen = new Set();

  const push = (url, role) => {
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    slots.push({ role, url });
  };

  const productUrls = Array.isArray(parts.productUrls) ? parts.productUrls : [];
  productUrls.forEach((url, i) => {
    push(url, i === 0 ? 'product_primary' : 'product_additional');
  });

  if (parts.avatarUrl) push(parts.avatarUrl, 'avatar');
  if (parts.brandLogoUrl) push(parts.brandLogoUrl, 'brand_logo');

  const additional = Array.isArray(parts.additionalUrls) ? parts.additionalUrls : [];
  additional.forEach((url) => push(url, 'creative_reference'));

  return {
    urls: slots.map((s) => s.url),
    slots,
  };
}

/**
 * Combined image budget validation (all categories together).
 *
 * @param {string[]} urls
 * @param {{ maxImages?: number }} [opts]
 */
export function validateMarketingImageBudget(urls, opts = {}) {
  const maxImages = opts.maxImages ?? MARKETING_MAX_IMAGES;
  const list = (urls || []).filter(Boolean);
  if (!list.length) {
    throw err('PRODUCT_IMAGE_REQUIRED', 'At least one product image is required');
  }
  if (list.length > maxImages) {
    throw err(
      'TOO_MANY_REFERENCES',
      `Marketing model accepts at most ${maxImages} images (got ${list.length})`
    );
  }
  return { count: list.length, maxImages, urls: list };
}

/**
 * Supplement user script with concise visual/messaging context — never replaces the script.
 *
 * @param {{
 *   userScript: string,
 *   productVisualDescription?: string|null,
 *   characterVisualDescription?: string|null,
 *   brandMessagingSupplement?: string|null,
 * }} input
 */
export function buildMarketingPrompt(input = {}) {
  const script = String(input.userScript || '').trim();
  const extras = [];
  if (input.productVisualDescription) {
    extras.push(`Product look: ${String(input.productVisualDescription).trim()}`);
  }
  if (input.characterVisualDescription) {
    extras.push(`Presenter look: ${String(input.characterVisualDescription).trim()}`);
  }
  if (input.brandMessagingSupplement) {
    extras.push(`Brand guidance: ${String(input.brandMessagingSupplement).trim()}`);
  }
  if (!extras.length) return script;
  if (!script) return extras.join(' ');
  return `${script}\n\n${extras.join(' ')}`.trim();
}

/**
 * Resolve a generation-ready Marketing source context.
 *
 * @param {{
 *   prompt: string,
 *   aspectRatio?: string,
 *   resolution?: string,
 *   duration?: number,
 *   format?: { id?: string|number, name?: string, url?: string }|null,
 *   product?: object|null,
 *   productRevision?: object|null,
 *   productAssets?: Array,
 *   selectedProductAssetIds?: string[]|null,
 *   productUploadUrl?: string|null,
 *   productAsset?: { id?: string, url?: string }|null,
 *   character?: object|null,
 *   characterRevision?: object|null,
 *   characterAssets?: Array,
 *   selectedCharacterAssetIds?: string[]|null,
 *   avatarUploadUrl?: string|null,
 *   avatarAsset?: { id?: string, url?: string }|null,
 *   avatarPreset?: { id?: string, name?: string, url?: string }|null,
 *   additionalUploadUrls?: string[],
 *   additionalAssets?: Array<{ id?: string, url?: string }>,
 *   maxImages?: number,
 * }} input
 */
export function resolveMarketingSourceContext(input = {}) {
  const capability = getMarketingModelCapability(input.resolution);
  const maxImages = input.maxImages ?? capability.maxImages;

  const brand = input.brand || null;
  const brandContext = input.brandContext || null;
  const includeBrandLogo = Boolean(input.includeBrandLogo);
  const brandLogoUrl =
    includeBrandLogo && brandContext?.visual?.logoUrl
      ? brandContext.visual.logoUrl
      : includeBrandLogo && input.brandLogoUrl
        ? input.brandLogoUrl
        : null;
  const brandLogoAssetId =
    includeBrandLogo && brandContext?.visual?.logoAssetId
      ? brandContext.visual.logoAssetId
      : includeBrandLogo && input.brandLogoAssetId
        ? input.brandLogoAssetId
        : null;

  // Reserve one slot when Brand logo will be sent to the model
  const brandSlot = brandLogoUrl ? 1 : 0;
  const avatarReserve = 1;

  const productAssets = normaliseProductAssetLinks(input.productAssets || []).filter(
    (a) => MARKETING_PRODUCT_ROLES.includes(a.role) || a.role === 'product_reference'
  );
  const productSelection = input.product
    ? selectProductReferences(productAssets, {
        maxImages: Math.max(1, maxImages - avatarReserve - brandSlot),
        selectedAssetIds: input.selectedProductAssetIds || null,
        preferredRoles: MARKETING_PRODUCT_ROLES,
      })
    : { references: [], urls: [], assetIds: [] };

  const productSource = resolveProductImageSource({
    uploadedUrl: input.productUploadUrl,
    asset: input.productAsset,
    productReferences: productSelection.references,
  });

  if (productSource.kind === 'none') {
    throw err('PRODUCT_IMAGE_REQUIRED', 'Please upload or select a product image');
  }

  const charSelection =
    input.character && !input.avatarUploadUrl && !input.avatarAsset
      ? selectCharacterReferences(input.characterAssets || [], {
          maxImages: 1,
          selectedAssetIds: input.selectedCharacterAssetIds || null,
        })
      : { references: [], urls: [], assetIds: [] };

  const avatarSource = resolveAvatarImageSource({
    uploadedUrl: input.avatarUploadUrl,
    asset: input.avatarAsset,
    characterReference: charSelection.references[0] || null,
    preset: input.avatarPreset || null,
  });

  const effectiveAvatar = avatarSource;

  const additionalUploads = Array.isArray(input.additionalUploadUrls)
    ? input.additionalUploadUrls
    : [];
  const additionalAssets = Array.isArray(input.additionalAssets)
    ? input.additionalAssets
    : [];
  const additionalUrls = [
    ...additionalUploads,
    ...additionalAssets.map((a) => a?.url).filter(Boolean),
  ];
  const additionalAssetIds = additionalAssets.map((a) => a?.id).filter(Boolean);

  const ordered = buildOrderedImageList({
    productUrls: productSource.urls,
    avatarUrl: effectiveAvatar.url,
    brandLogoUrl,
    additionalUrls,
  });

  validateMarketingImageBudget(ordered.urls, { maxImages });

  const productVisual =
    input.product && productSource.kind === 'product'
      ? buildProductVisualDescription(input.product, input.productRevision)
      : null;
  const characterVisual =
    input.character && effectiveAvatar.kind === 'character'
      ? buildVisualDescription(input.character, input.characterRevision)
      : null;
  const brandMessagingSupplement = brand
    ? buildBrandMessagingSupplement(
        brandContext?.messaging || input.brandMessaging || null
      )
    : '';

  const prompt = buildMarketingPrompt({
    userScript: input.prompt,
    productVisualDescription: productVisual,
    characterVisualDescription: characterVisual,
    brandMessagingSupplement: brandMessagingSupplement || null,
  });

  const productId =
    productSource.kind === 'product' ? input.product?.id || null : null;
  const productRevisionId =
    productSource.kind === 'product'
      ? input.productRevision?.id || input.product?.currentRevisionId || null
      : null;
  const characterId =
    effectiveAvatar.kind === 'character' ? input.character?.id || null : null;
  const characterRevisionId =
    effectiveAvatar.kind === 'character'
      ? input.characterRevision?.id || input.character?.currentRevisionId || null
      : null;
  const brandId = brand?.id || brandContext?.provenance?.brandId || null;
  const brandRevisionId =
    brandContext?.provenance?.brandRevisionId ||
    brand?.currentRevisionId ||
    null;

  return {
    prompt,
    userScript: String(input.prompt || '').trim(),
    aspectRatio: input.aspectRatio || '9:16',
    resolution: input.resolution || '1080p',
    duration: input.duration ?? 5,
    format: input.format
      ? {
          id: input.format.id ?? null,
          name: input.format.name || null,
          url: input.format.url || null,
        }
      : null,
    videoFiles: input.format?.url ? [input.format.url] : [],
    imagesList: ordered.urls,
    imageSlots: ordered.slots,
    productSource,
    avatarSource: effectiveAvatar,
    productId,
    productRevisionId,
    productReferenceAssetIds: productSource.productReferenceAssetIds,
    characterId,
    characterRevisionId,
    characterReferenceAssetId: effectiveAvatar.characterReferenceAssetId,
    brandId,
    brandRevisionId,
    brandLogoAssetId,
    brandLogoUrl,
    additionalAssetIds,
    orderedInputAssetIds: [
      ...productSource.assetIds,
      ...(effectiveAvatar.assetId ? [effectiveAvatar.assetId] : []),
      ...(brandLogoAssetId ? [brandLogoAssetId] : []),
      ...additionalAssetIds,
    ].filter(Boolean),
    capability,
    provenance: {
      productId,
      productRevisionId,
      productReferenceAssetIds: productSource.productReferenceAssetIds,
      characterId,
      characterRevisionId,
      characterReferenceAssetId: effectiveAvatar.characterReferenceAssetId,
      brandId,
      brandRevisionId,
      brandLogoAssetId,
      additionalAssetIds,
      orderedInputAssetIds: [
        ...productSource.assetIds,
        ...(effectiveAvatar.assetId ? [effectiveAvatar.assetId] : []),
        ...(brandLogoAssetId ? [brandLogoAssetId] : []),
        ...additionalAssetIds,
      ].filter(Boolean),
      imageSlots: ordered.slots,
      avatarSourceKind: effectiveAvatar.kind,
      productSourceKind: productSource.kind,
      formatId: input.format?.id ?? null,
      formatName: input.format?.name || null,
      avatarPreset:
        effectiveAvatar.kind === 'preset' ? effectiveAvatar.preset : null,
      continuity: 'reference-based',
      consumer: 'marketing-studio',
    },
  };
}

/**
 * Publish Product + Character provenance for Marketing lifecycle in one shot.
 * Character publish replaces generationMetadata; we pass the full merged bag once.
 */
export function publishMarketingGenerationContext(ctx = {}) {
  const generationMetadata = {
    consumer: 'marketing-studio',
    featureId: 'marketing-studio',
    ...(ctx.generationMetadata && typeof ctx.generationMetadata === 'object'
      ? ctx.generationMetadata
      : {}),
    ...(ctx.provenance && typeof ctx.provenance === 'object' ? ctx.provenance : {}),
    productReferenceAssetIds: ctx.productReferenceAssetIds || null,
    characterReferenceAssetIds: ctx.characterReferenceAssetId
      ? [ctx.characterReferenceAssetId]
      : null,
    brandId: ctx.brandId || null,
    brandRevisionId: ctx.brandRevisionId || null,
    brandLogoAssetId: ctx.brandLogoAssetId || null,
    orderedInputAssetIds: ctx.orderedInputAssetIds || null,
    additionalAssetIds: ctx.additionalAssetIds || null,
    imageSlots: ctx.imageSlots || null,
    formatId: ctx.format?.id ?? ctx.formatId ?? null,
    formatName: ctx.format?.name || ctx.formatName || null,
    avatarSourceKind: ctx.avatarSource?.kind || ctx.avatarSourceKind || null,
    productSourceKind: ctx.productSource?.kind || ctx.productSourceKind || null,
    avatarPreset: ctx.avatarSource?.preset || ctx.avatarPreset || null,
  };

  // Product bridge first (merge-friendly), then Character with full metadata
  if (ctx.productId) {
    publishProductGenerationContext({
      productId: ctx.productId,
      productRevisionId: ctx.productRevisionId || null,
      referenceAssetIds: ctx.productReferenceAssetIds || null,
      generationMetadata,
    });
  } else {
    clearProductGenerationContext();
  }

  if (ctx.characterId) {
    publishCharacterGenerationContext({
      characterId: ctx.characterId,
      characterRevisionId: ctx.characterRevisionId || null,
      referenceAssetIds: ctx.characterReferenceAssetId
        ? [ctx.characterReferenceAssetId]
        : null,
      generationMetadata,
    });
  } else {
    // Preserve product metadata if Character cleared — republish product bag only
    if (typeof window !== 'undefined') {
      window.__dynaxisCharacterId = null;
      window.__dynaxisCharacterRevisionId = null;
      window.__dynaxisCharacterReferenceAssetIds = null;
      window.__dynaxisGenerationMetadata = generationMetadata;
    }
  }

  if (ctx.brandId) {
    publishBrandGenerationContext({
      brandId: ctx.brandId,
      brandRevisionId: ctx.brandRevisionId || null,
      logoAssetId: ctx.brandLogoAssetId || null,
      generationMetadata,
    });
  } else {
    clearBrandGenerationContext();
  }

  if (
    typeof window !== 'undefined' &&
    !ctx.productId &&
    !ctx.characterId &&
    !ctx.brandId
  ) {
    window.__dynaxisGenerationMetadata = generationMetadata;
  }
}

export function clearMarketingGenerationContext() {
  clearProductGenerationContext();
  clearCharacterGenerationContext();
  clearBrandGenerationContext();
  if (typeof window !== 'undefined') {
    window.__dynaxisGenerationMetadata = null;
  }
}
