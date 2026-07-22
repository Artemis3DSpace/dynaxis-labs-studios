/**
 * Product Studio domain capability — headless-friendly.
 * Scene styling stays on Generation metadata; Product identity mutates only via explicit edits/promote.
 */

import {
  PRODUCT_ASPECT_RATIOS,
  PRODUCT_EDIT_ENDPOINT,
  PRODUCT_OUTPUT_FORMAT,
  PRODUCT_RESOLUTIONS,
  PRODUCT_SCENE_PRESETS,
  MAX_PRODUCT_REFERENCE_IMAGES,
  DEFAULT_SCENE_PRESET,
  buildScenePrompt,
  getScenePresetByName,
  isValidAspectRatio,
  isValidResolution,
} from './presets.js';

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export function validateSceneRequest(input) {
  const productId = String(input?.productId || '').trim();
  if (!productId) throw err('PRODUCT_ID_REQUIRED', 'productId is required');

  const aspectRatio = String(input?.aspectRatio || '1:1').trim();
  const resolution = String(input?.resolution || '1k').trim();
  if (!isValidAspectRatio(aspectRatio)) {
    throw err('INVALID_ASPECT', `Unsupported aspect ratio: ${aspectRatio}`);
  }
  if (!isValidResolution(resolution)) {
    throw err('INVALID_RESOLUTION', `Unsupported resolution: ${resolution}`);
  }

  const refs = Array.isArray(input?.referenceAssets) ? input.referenceAssets : [];
  if (refs.length > MAX_PRODUCT_REFERENCE_IMAGES) {
    throw err(
      'TOO_MANY_REFERENCES',
      `At most ${MAX_PRODUCT_REFERENCE_IMAGES} reference images for ${PRODUCT_EDIT_ENDPOINT}`
    );
  }

  const selectedIds = Array.isArray(input?.selectedAssetIds)
    ? input.selectedAssetIds.filter(Boolean)
    : null;
  if (selectedIds && selectedIds.length > MAX_PRODUCT_REFERENCE_IMAGES) {
    throw err(
      'TOO_MANY_REFERENCES',
      `At most ${MAX_PRODUCT_REFERENCE_IMAGES} selected Product references`
    );
  }

  return {
    productId,
    prompt: input?.prompt ? String(input.prompt).trim() : '',
    scenePreset: input?.scenePreset
      ? String(input.scenePreset).trim()
      : DEFAULT_SCENE_PRESET,
    aspectRatio,
    resolution,
    referenceAssets: refs,
    selectedAssetIds: selectedIds,
    brandId: input?.brandId ? String(input.brandId).trim() : null,
    includeBrandLogo: Boolean(input?.includeBrandLogo),
  };
}

/**
 * Resolve reference image URLs for nano-banana-2-edit.
 */
export async function resolveProductReferenceUrls(
  runtime,
  productId,
  explicitRefs = [],
  selectedAssetIds = null
) {
  const urls = [];
  const refs = [];
  const max = MAX_PRODUCT_REFERENCE_IMAGES;

  const pushRef = (ref) => {
    if (urls.length >= max) return;
    const url = ref.url;
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (urls.includes(url)) return;
    urls.push(url);
    refs.push(ref);
  };

  if (selectedAssetIds?.length) {
    const data = await runtime.listProductAssets(productId);
    const links = data?.assets || data || [];
    const byId = new Map(
      links.map((l) => [l.assetId || l.asset?.id, l])
    );
    for (const id of selectedAssetIds) {
      const link = byId.get(id);
      if (!link) continue;
      pushRef({
        assetId: id,
        url: link.asset?.url || link.url,
        role: link.role || 'product_reference',
      });
    }
  }

  for (const ref of explicitRefs) {
    if (ref.url && /^https?:\/\//i.test(ref.url)) {
      pushRef(ref);
      continue;
    }
    if (ref.assetId) {
      const listed = await runtime.listAssets({ limit: 100 });
      const assets = listed?.assets || [];
      const found = assets.find((a) => a.id === ref.assetId);
      if (found?.url) {
        pushRef({ ...ref, url: found.url });
      }
    }
  }

  if (!urls.length && productId) {
    const data = await runtime.listProductAssets(productId);
    const links = data?.assets || data || [];
    const identityRoles = new Set([
      'product_reference',
      'transparent_product_reference',
      'packaging_reference',
      'label_reference',
      'detail_reference',
      'logo_reference',
    ]);
    for (const link of links) {
      const role = link.role || 'product_reference';
      if (!identityRoles.has(role)) continue;
      const url = link.asset?.url || link.url;
      pushRef({
        assetId: link.assetId || link.asset?.id,
        url,
        role,
      });
    }
  }

  return { urls, refs };
}

export function buildProductSceneGenerationRequest({
  product,
  visualDescription,
  scenePreset,
  customPrompt,
  aspectRatio,
  resolution,
  referenceUrls,
  referenceAssets,
  brandId = null,
  brandRevisionId = null,
}) {
  const preset = getScenePresetByName(scenePreset);
  const fullPrompt = buildScenePrompt({
    productVisualDescription: visualDescription,
    scenePresetName: scenePreset,
    customPrompt,
  });

  return {
    modelId: PRODUCT_EDIT_ENDPOINT,
    endpoint: PRODUCT_EDIT_ENDPOINT,
    prompt: fullPrompt,
    outputType: 'image',
    productId: product.id,
    productRevisionId: product.currentRevisionId || null,
    brandId: brandId || null,
    brandRevisionId: brandRevisionId || null,
    parameters: {
      prompt: fullPrompt,
      images_list: referenceUrls,
      aspect_ratio: aspectRatio,
      resolution,
      google_search: false,
      output_format: PRODUCT_OUTPUT_FORMAT,
      productId: product.id,
      productRevisionId: product.currentRevisionId || null,
      scenePreset: preset?.name || scenePreset || null,
      productPreset: preset?.id || null,
      ...(brandId ? { brandId } : {}),
      ...(brandRevisionId ? { brandRevisionId } : {}),
    },
    referenceAssets: (referenceAssets || []).map((r) => ({
      assetId: r.assetId,
      url: r.url,
      role: r.role || 'product_reference',
    })),
  };
}

export async function generateProductScene(runtime, input) {
  if (!runtime?.createGeneration) {
    throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  }
  const req = validateSceneRequest(input);
  const prodRes = await runtime.getProduct(req.productId, { includeAssets: 'true' });
  const product = prodRes?.product || prodRes;
  if (!product?.id) throw err('PRODUCT_NOT_FOUND', 'Product not found');

  const { urls: resolvedUrls, refs: resolvedRefs } = await resolveProductReferenceUrls(
    runtime,
    product.id,
    req.referenceAssets,
    req.selectedAssetIds
  );
  if (!resolvedUrls.length) {
    throw err(
      'REFERENCES_REQUIRED',
      'At least one Product reference image is required for scene generation'
    );
  }
  if (resolvedUrls.length > MAX_PRODUCT_REFERENCE_IMAGES) {
    throw err(
      'TOO_MANY_REFERENCES',
      `At most ${MAX_PRODUCT_REFERENCE_IMAGES} reference images`
    );
  }

  try {
    const ctx = runtime.getProjectContext();
    if (ctx?.projectId) {
      await runtime.linkProductToProject(product.id, ctx.projectId);
    }
  } catch {
    // non-fatal
  }

  const visualDescription =
    product.visualDescription || product.description || product.name || '';

  let brandId = req.brandId || null;
  let brandRevisionId = null;
  const urls = [...resolvedUrls];
  const refs = [...resolvedRefs];

  if (brandId && req.includeBrandLogo && typeof runtime.getBrand === 'function') {
    try {
      const brandRes = await runtime.getBrand(brandId, { includeAssets: 'true' });
      const brand = brandRes?.brand || brandRes;
      brandRevisionId = brand?.currentRevisionId || null;
      const assets = brandRes?.assets || brand?.assets || [];
      const logo =
        assets.find((a) => a.role === 'primary_logo' && (a.asset?.url || a.url)) ||
        assets.find((a) =>
          ['wordmark', 'brand_mark', 'alternate_logo', 'brand_reference'].includes(
            a.role
          )
        );
      const logoUrl = logo?.asset?.url || logo?.url;
      if (logoUrl && urls.length < MAX_PRODUCT_REFERENCE_IMAGES && !urls.includes(logoUrl)) {
        urls.push(logoUrl);
        refs.push({
          assetId: logo.assetId || logo.asset?.id,
          url: logoUrl,
          role: logo.role || 'primary_logo',
        });
      }
    } catch {
      // Brand logo optional — non-fatal
    }
  } else if (brandId && typeof runtime.getBrand === 'function') {
    try {
      const brandRes = await runtime.getBrand(brandId);
      brandRevisionId = brandRes?.brand?.currentRevisionId || null;
    } catch {
      // optional
    }
  }

  if (urls.length > MAX_PRODUCT_REFERENCE_IMAGES) {
    throw err(
      'TOO_MANY_REFERENCES',
      `At most ${MAX_PRODUCT_REFERENCE_IMAGES} reference images`
    );
  }

  const generationRequest = buildProductSceneGenerationRequest({
    product,
    visualDescription,
    scenePreset: req.scenePreset,
    customPrompt: req.prompt,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    referenceUrls: urls,
    referenceAssets: refs,
    brandId,
    brandRevisionId,
  });

  const outcome = await runtime.createGeneration(generationRequest);

  // Tag outputs as generated_product_scene — do NOT auto-promote to product_reference
  const assets = outcome?.assets || [];
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (!asset?.id) continue;
    try {
      await runtime.addProductAsset(product.id, {
        assetId: asset.id,
        role: 'generated_product_scene',
        sortOrder: i,
        isPrimary: false,
        createRevision: false,
      });
    } catch {
      // Asset may already be linked / platform optional
    }
  }

  return outcome;
}

/**
 * Generate multiple scenes for the same Product (photo pack).
 * Sequential — each call is an independent Generation.
 */
export async function generateProductPhotoPack(runtime, input) {
  const presets = Array.isArray(input?.presets) && input.presets.length
    ? input.presets
    : PRODUCT_SCENE_PRESETS.map((p) => p.name);
  const results = [];
  for (const scenePreset of presets) {
    const outcome = await generateProductScene(runtime, {
      ...input,
      scenePreset,
    });
    results.push({ scenePreset, outcome });
  }
  return { results };
}

export async function createProductCapability(runtime, input) {
  return runtime.createProduct(input);
}

export async function updateProductCapability(runtime, productId, input) {
  return runtime.updateProduct(productId, input);
}

/**
 * Explicit promotion only — scenes are not canonical identity by default.
 */
export async function promoteProductReference(runtime, productId, assetId, opts = {}) {
  return runtime.promoteProductAsset(productId, {
    assetId,
    role: opts.role || 'product_reference',
    isPrimary: opts.isPrimary !== false,
  });
}

export async function invokeCapability(name, args, runtime) {
  switch (name) {
    case 'createProduct':
      return createProductCapability(runtime, args || {});
    case 'updateProduct':
      return updateProductCapability(runtime, args?.productId, args || {});
    case 'generateProductScene':
    case 'generate':
      return generateProductScene(runtime, args || {});
    case 'generateProductPhotoPack':
    case 'photoPack':
      return generateProductPhotoPack(runtime, args || {});
    case 'promoteReference':
    case 'promoteProductReference':
      return promoteProductReference(
        runtime,
        args?.productId,
        args?.assetId,
        args || {}
      );
    case 'listAspectRatios':
      return { aspectRatios: PRODUCT_ASPECT_RATIOS };
    case 'listResolutions':
      return { resolutions: PRODUCT_RESOLUTIONS };
    case 'listScenePresets':
      return { presets: PRODUCT_SCENE_PRESETS };
    case 'buildPlan':
      return buildProductSceneGenerationRequest(args || {});
    default: {
      throw err('UNKNOWN_CAPABILITY', `Unknown Product Studio capability: ${name}`);
    }
  }
}

export {
  PRODUCT_ASPECT_RATIOS,
  PRODUCT_RESOLUTIONS,
  PRODUCT_SCENE_PRESETS,
  PRODUCT_EDIT_ENDPOINT,
  MAX_PRODUCT_REFERENCE_IMAGES,
};
