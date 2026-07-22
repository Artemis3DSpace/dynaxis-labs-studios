/**
 * Character Studio presets — MuAPI nano-banana-pro parameters from
 * SamurAIGPT/ai-character-studio standaloneConfig (MIT).
 */

import { CHARACTER_CATEGORIES, CHARACTER_VISUAL_MODELS } from '../../../lib/dynaxis/types.js';

export const CHARACTER_GENERATE_ENDPOINT = CHARACTER_VISUAL_MODELS.generate;
export const CHARACTER_EDIT_ENDPOINT = CHARACTER_VISUAL_MODELS.edit;

export const CHARACTER_ASPECT_RATIOS = [
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
];

export const CHARACTER_RESOLUTIONS = [
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' },
];

export const CHARACTER_STUDIO_CATEGORIES = [...CHARACTER_CATEGORIES];

export const MAX_REFERENCE_IMAGES = 5;

/**
 * Artistic image system prefix used by upstream for portrait rendering.
 * Character persona system prompts are separate (chat).
 */
export const CHARACTER_VISUAL_SYSTEM_PREFIX =
  'You are an artistic AI that generates photorealistic image renderings based on text prompts.';

export function isValidAspectRatio(value) {
  return CHARACTER_ASPECT_RATIOS.includes(String(value || ''));
}

export function isValidResolution(value) {
  return CHARACTER_RESOLUTIONS.some((r) => r.value === String(value || ''));
}
