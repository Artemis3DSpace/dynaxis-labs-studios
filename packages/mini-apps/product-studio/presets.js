/**
 * Product Studio presets — scene photography from
 * SamurAIGPT/amazon-product-studio (MIT). Branding stripped; platform-neutral.
 */

import { PRODUCT_VISUAL_MODELS } from '../../../lib/dynaxis/types.js';

export const PRODUCT_EDIT_ENDPOINT = PRODUCT_VISUAL_MODELS.edit;

/** Model max reference inputs for nano-banana-2-edit (verified in models.js). */
export const MAX_PRODUCT_REFERENCE_IMAGES = 14;

export const PRODUCT_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'];

export const PRODUCT_RESOLUTIONS = [
  { label: '1K', value: '1k' },
];

export const PRODUCT_OUTPUT_FORMAT = 'jpg';

export const DEFAULT_SCENE_PRESET = 'Minimalist Marble';

/**
 * Verified scene presets from upstream page.js — prompt templates only.
 * Scene styling is Generation metadata, not Product identity.
 */
export const PRODUCT_SCENE_PRESETS = [
  {
    id: 'minimalist-marble',
    name: 'Minimalist Marble',
    description: 'Elegant block with natural daylight',
    prompt:
      'A professional product photograph of the product sitting on a clean minimalist white marble block pedestal, soft shadows, warm natural studio light, blurred plants in the background, commercial advertisement style.',
  },
  {
    id: 'luxury-spotlight',
    name: 'Luxury Spotlight',
    description: 'Moody highlight with dark reflection',
    prompt:
      'A professional product photograph of the product sitting on a black reflective glossy surface, dark moody backdrop, dramatic violet spotlight, professional studio commercial lighting, premium design aesthetic.',
  },
  {
    id: 'rustic-wood',
    name: 'Rustic Wood',
    description: 'Cozy home table with window light',
    prompt:
      'A professional product photograph of the product sitting on a rustic warm wood table, cozy sunny kitchen background, blurred sunlight through a window, green leaves, natural homeware lifestyle style.',
  },
  {
    id: 'granite-countertop',
    name: 'Granite Countertop',
    description: 'Modern granite kitchen surface',
    prompt:
      'A professional product photograph of the product sitting on a modern clean dark granite kitchen countertop, blurred modern high-end kitchen background, bright direct sun rays, elegant look.',
  },
  {
    id: 'sunny-beach',
    name: 'Sunny Beach',
    description: 'Warm golden sand & blurred ocean',
    prompt:
      'A professional product photograph of the product resting on golden sea sand, beach seashore background, warm sunny afternoon light, blurry turquoise tropical ocean waves, summer commercial vibe.',
  },
  {
    id: 'forest-moss',
    name: 'Forest Moss',
    description: 'Organic stone in green woods',
    prompt:
      'A professional product photograph of the product placed on a wet mossy green stone, lush magical forest backdrop, warm sun rays breaking through tree canopy, clean soft shadows, organic nature style.',
  },
  {
    id: 'modern-office',
    name: 'Modern Office',
    description: 'Corporate office workspace desk',
    prompt:
      'A professional product photograph of the product placed on a clean modern office desk, blurry keyboard, office plant and mug, bright corporate home office background, corporate professional style.',
  },
];

export function getScenePresetByName(name) {
  const key = String(name || '').trim().toLowerCase();
  return (
    PRODUCT_SCENE_PRESETS.find(
      (p) => p.name.toLowerCase() === key || p.id === key
    ) || null
  );
}

export function isValidAspectRatio(value) {
  return PRODUCT_ASPECT_RATIOS.includes(String(value || ''));
}

export function isValidResolution(value) {
  return PRODUCT_RESOLUTIONS.some((r) => r.value === String(value || ''));
}

/**
 * Compose final generation prompt from product visual context + scene styling.
 * Does not inject unsupported commercial claims.
 */
export function buildScenePrompt({
  productVisualDescription,
  scenePresetName,
  customPrompt,
}) {
  const preset = getScenePresetByName(scenePresetName);
  const sceneText =
    (customPrompt && String(customPrompt).trim()) ||
    preset?.prompt ||
    getScenePresetByName(DEFAULT_SCENE_PRESET)?.prompt ||
    '';
  const identity = productVisualDescription
    ? String(productVisualDescription).trim()
    : '';
  if (identity && sceneText) {
    return `Product identity: ${identity}. Scene: ${sceneText}`.trim();
  }
  return sceneText || identity;
}
