/**
 * Design Component category registry (restrained, extensible).
 * Client-safe.
 */

import { DESIGN_COMPONENT_CATEGORIES } from '../types.js';

export { DESIGN_COMPONENT_CATEGORIES };

/** @type {Record<string, { id: string, label: string }>} */
export const DESIGN_COMPONENT_CATEGORY_META = {
  cta: { id: 'cta', label: 'CTA' },
  card: { id: 'card', label: 'Card' },
  header: { id: 'header', label: 'Header' },
  badge: { id: 'badge', label: 'Badge' },
  product: { id: 'product', label: 'Product' },
  social: { id: 'social', label: 'Social' },
  branding: { id: 'branding', label: 'Branding' },
  content: { id: 'content', label: 'Content' },
  custom: { id: 'custom', label: 'Custom' },
};

/**
 * @param {string} category
 */
export function isDesignComponentCategory(category) {
  return DESIGN_COMPONENT_CATEGORIES.includes(/** @type {any} */ (category));
}

/**
 * @param {string | null | undefined} category
 */
export function normalizeDesignComponentCategory(category) {
  if (category && isDesignComponentCategory(category)) return category;
  return 'custom';
}
