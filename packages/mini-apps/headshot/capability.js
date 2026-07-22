/**
 * AI Headshot domain capability — headless-friendly.
 * Separated from UI for future Skills / Agents.
 */

import {
  HEADSHOT_ASPECT_RATIOS,
  HEADSHOT_CATEGORIES,
  HEADSHOT_MUAPI_ENDPOINT,
  isValidHeadshotAspectRatio,
  isValidHeadshotCategory,
} from './presets.js';

/**
 * @typedef {Object} HeadshotRequest
 * @property {string} [imageUrl]
 * @property {string} [assetId]
 * @property {string} category
 * @property {string} [aspectRatio]
 */

/**
 * Validate and normalise a headshot request.
 * @param {HeadshotRequest} input
 */
export function validateHeadshotRequest(input) {
  const category = String(input?.category || '').trim();
  const aspectRatio = String(input?.aspectRatio || '1:1').trim();
  const imageUrl = input?.imageUrl ? String(input.imageUrl).trim() : null;
  const assetId = input?.assetId ? String(input.assetId).trim() : null;

  if (!imageUrl && !assetId) {
    const err = new Error('A portrait reference image is required');
    err.code = 'HEADSHOT_MISSING_REFERENCE';
    throw err;
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    const err = new Error('Portrait reference must be an http(s) URL');
    err.code = 'HEADSHOT_INVALID_REFERENCE';
    throw err;
  }
  if (!isValidHeadshotCategory(category)) {
    const err = new Error(`Unknown headshot style category: ${category}`);
    err.code = 'HEADSHOT_INVALID_CATEGORY';
    throw err;
  }
  if (!isValidHeadshotAspectRatio(aspectRatio)) {
    const err = new Error(`Unsupported aspect ratio: ${aspectRatio}`);
    err.code = 'HEADSHOT_INVALID_ASPECT';
    throw err;
  }

  return {
    imageUrl,
    assetId,
    category,
    aspectRatio,
  };
}

/**
 * Build Dynaxis Mini App generation request for photo-pack.
 * @param {HeadshotRequest & { imageUrl: string }} input
 */
export function buildHeadshotGenerationRequest(input) {
  const req = validateHeadshotRequest(input);
  if (!req.imageUrl) {
    const err = new Error('imageUrl is required to build the generation request');
    err.code = 'HEADSHOT_MISSING_REFERENCE';
    throw err;
  }

  return {
    modelId: HEADSHOT_MUAPI_ENDPOINT,
    endpoint: HEADSHOT_MUAPI_ENDPOINT,
    prompt: `Professional headshot pack — style: ${req.category}`,
    outputType: 'image',
    parameters: {
      image_url: req.imageUrl,
      category: req.category,
      aspect_ratio: req.aspectRatio,
      headshotPreset: req.category,
    },
    referenceAssets: [
      {
        ...(req.assetId ? { assetId: req.assetId } : {}),
        url: req.imageUrl,
        role: 'portrait_reference',
      },
    ],
  };
}

/**
 * Resolve image URL from an asset list entry or direct URL.
 * @param {{ url?: string, imageUrl?: string } | null} asset
 * @param {string | null} fallbackUrl
 */
export function resolvePortraitUrl(asset, fallbackUrl = null) {
  const fromAsset = asset?.url || asset?.imageUrl || null;
  const url = fromAsset || fallbackUrl;
  if (!url || !/^https?:\/\//i.test(url)) {
    const err = new Error('Could not resolve portrait reference URL');
    err.code = 'HEADSHOT_INVALID_REFERENCE';
    throw err;
  }
  return url;
}

/**
 * Run headshot generation through Mini App runtime (UI + future Skills).
 * @param {object} runtime — createMiniAppRuntime result
 * @param {HeadshotRequest} input
 */
export async function generateHeadshot(runtime, input) {
  if (!runtime || typeof runtime.createGeneration !== 'function') {
    const err = new Error('Mini App runtime is required');
    err.code = 'HEADSHOT_RUNTIME_MISSING';
    throw err;
  }

  let imageUrl = input.imageUrl || null;
  let assetId = input.assetId || null;

  if (assetId && !imageUrl) {
    const listed = await runtime.listAssets({ limit: 100 });
    const assets = listed?.assets || listed || [];
    const found = Array.isArray(assets)
      ? assets.find((a) => a.id === assetId)
      : null;
    if (!found) {
      const err = new Error('Reference asset not found in active project');
      err.code = 'HEADSHOT_ASSET_NOT_FOUND';
      throw err;
    }
    imageUrl = resolvePortraitUrl(found);
  }

  const generationRequest = buildHeadshotGenerationRequest({
    ...input,
    imageUrl,
    assetId,
  });

  return runtime.createGeneration(generationRequest);
}

/**
 * Headless capability dispatcher for future Skills/Agents.
 */
export async function invokeCapability(name, args, runtime) {
  if (name === 'generateHeadshot' || name === 'generate') {
    return generateHeadshot(runtime, args || {});
  }
  if (name === 'listCategories') {
    return { categories: HEADSHOT_CATEGORIES };
  }
  if (name === 'listAspectRatios') {
    return { aspectRatios: HEADSHOT_ASPECT_RATIOS };
  }
  if (name === 'buildPlan') {
    return buildHeadshotGenerationRequest(args || {});
  }
  if (name === 'validate') {
    return validateHeadshotRequest(args || {});
  }
  const err = new Error(`Unknown Headshot capability: ${name}`);
  err.code = 'UNKNOWN_CAPABILITY';
  throw err;
}

export {
  HEADSHOT_CATEGORIES,
  HEADSHOT_ASPECT_RATIOS,
  HEADSHOT_MUAPI_ENDPOINT,
};
