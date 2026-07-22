/**
 * Design Template categories + lightweight tags (client-safe).
 */

import {
  DESIGN_TEMPLATE_CATEGORIES,
  DESIGN_TEMPLATE_STATUSES,
} from '../types.js';

export { DESIGN_TEMPLATE_CATEGORIES, DESIGN_TEMPLATE_STATUSES };

/**
 * @param {string} category
 */
export function isDesignTemplateCategory(category) {
  return DESIGN_TEMPLATE_CATEGORIES.includes(/** @type {any} */ (category));
}

/**
 * @param {string} status
 */
export function isDesignTemplateStatus(status) {
  return DESIGN_TEMPLATE_STATUSES.includes(/** @type {any} */ (status));
}

/**
 * Normalize tags to lowercase trimmed unique strings.
 * @param {unknown} tags
 * @returns {string[]}
 */
export function normalizeTemplateTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of tags) {
    const t = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .slice(0, 48);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 24) break;
  }
  return out;
}
