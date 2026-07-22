/**
 * Dynaxis Mini App Registry — central discovery for trusted first-party modules.
 *
 * Feature Registry = major Dynaxis product capabilities (Image Studio, Workflows, …).
 * Mini App Registry = specialised modular applications under Apps.
 */

import {
  parseMiniAppManifest,
  validateManifestConsistency,
} from './manifest.js';

/**
 * @typedef {import('./manifest.js').MiniAppManifest} MiniAppManifest
 */

/**
 * @typedef {Object} MiniAppRegistration
 * @property {MiniAppManifest} manifest
 * @property {string} [loaderKey]
 */

export class MiniAppRegistry {
  constructor() {
    /** @type {Map<string, MiniAppRegistration>} */
    this._modules = new Map();
  }

  /**
   * @param {unknown} manifestInput
   * @param {{ loaderKey?: string }} [opts]
   */
  register(manifestInput, opts = {}) {
    const manifest = parseMiniAppManifest(manifestInput);
    if (this._modules.has(manifest.id)) {
      const err = new Error(`Mini App already registered: ${manifest.id}`);
      err.code = 'DUPLICATE_MINI_APP';
      throw err;
    }
    const warnings = validateManifestConsistency(manifest);
    if (warnings.length && typeof console !== 'undefined') {
      console.warn(`[Dynaxis MiniApp] ${manifest.id}:`, warnings.join('; '));
    }
    const loaderKey = opts.loaderKey || manifest.entryKey;
    if (loaderKey !== manifest.entryKey) {
      const err = new Error(
        `loaderKey (${loaderKey}) must match manifest.entryKey (${manifest.entryKey})`
      );
      err.code = 'LOADER_KEY_MISMATCH';
      throw err;
    }
    this._modules.set(manifest.id, { manifest, loaderKey });
    return manifest;
  }

  /**
   * @param {string} id
   * @returns {MiniAppManifest | null}
   */
  get(id) {
    return this._modules.get(id)?.manifest || null;
  }

  /**
   * @param {string} id
   * @returns {MiniAppRegistration | null}
   */
  getRegistration(id) {
    return this._modules.get(id) || null;
  }

  /**
   * @param {{ status?: string|string[], category?: string, includeDisabled?: boolean, includeExperimental?: boolean }} [filter]
   * @returns {MiniAppManifest[]}
   */
  list(filter = {}) {
    let items = [...this._modules.values()].map((r) => r.manifest);
    const statuses = filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;
    if (statuses) {
      items = items.filter((m) => statuses.includes(m.status));
    }
    if (filter.category) {
      items = items.filter((m) => m.category === filter.category);
    }
    if (!filter.includeDisabled) {
      items = items.filter((m) => m.status !== 'disabled');
    }
    if (!filter.includeExperimental) {
      items = items.filter((m) => m.status !== 'experimental');
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Modules safe to present as installed/usable in Apps UI.
   */
  listUserVisible() {
    return this.list({
      status: ['integrated', 'available'],
      includeExperimental: false,
      includeDisabled: false,
    });
  }

  /**
   * @param {string} id
   */
  has(id) {
    return this._modules.has(id);
  }

  clear() {
    this._modules.clear();
  }

  size() {
    return this._modules.size;
  }
}

/** Singleton used by the Dynaxis host */
export const miniAppRegistry = new MiniAppRegistry();

export function createMiniAppRegistry() {
  return new MiniAppRegistry();
}
