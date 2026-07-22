/**
 * Allowlisted lazy loader for trusted Mini App modules.
 * Rejects arbitrary client-provided paths — no remote code execution.
 */

import { miniAppRegistry } from './registry.js';

/**
 * Approved entryKey → dynamic import factory.
 * Only keys present here can be loaded.
 */
const APPROVED_LOADERS = {
  'dynaxis.example': () => import('../../../packages/mini-apps/example/index.js'),
  'dynaxis.headshot': () => import('../../../packages/mini-apps/headshot/index.js'),
  'dynaxis.character-studio': () =>
    import('../../../packages/mini-apps/character-studio/index.js'),
  'dynaxis.product-studio': () =>
    import('../../../packages/mini-apps/product-studio/index.js'),
  'dynaxis.brand-studio': () =>
    import('../../../packages/mini-apps/brand-studio/index.js'),
  'dynaxis.campaign-studio': () =>
    import('../../../packages/mini-apps/campaign-studio/index.js'),
  'dynaxis.creative-editor': () =>
    import('../../../packages/mini-apps/creative-editor/index.js'),
  'dynaxis.design-library': () =>
    import('../../../packages/mini-apps/design-library/index.js'),
};

/**
 * @returns {readonly string[]}
 */
export function listApprovedLoaderKeys() {
  return Object.freeze(Object.keys(APPROVED_LOADERS));
}

/**
 * @param {string} entryKey
 * @returns {boolean}
 */
export function isApprovedLoaderKey(entryKey) {
  return Object.prototype.hasOwnProperty.call(APPROVED_LOADERS, entryKey);
}

/**
 * Resolve and lazy-load a registered Mini App module.
 * @param {string} miniAppId
 * @returns {Promise<{ manifest: import('./manifest.js').MiniAppManifest, module: any }>}
 */
export async function loadMiniApp(miniAppId) {
  const registration = miniAppRegistry.getRegistration(miniAppId);
  if (!registration) {
    const err = new Error(`Unknown Mini App: ${miniAppId}`);
    err.code = 'MINI_APP_NOT_FOUND';
    throw err;
  }
  const { manifest } = registration;
  if (manifest.status === 'disabled') {
    const err = new Error(`Mini App is disabled: ${miniAppId}`);
    err.code = 'MINI_APP_DISABLED';
    throw err;
  }
  if (manifest.status === 'catalogue' || manifest.status === 'external') {
    const err = new Error(
      `Mini App ${miniAppId} is catalogue/external and has no internal entrypoint`
    );
    err.code = 'MINI_APP_NOT_INTEGRATED';
    throw err;
  }
  const entryKey = manifest.entryKey;
  if (!isApprovedLoaderKey(entryKey)) {
    const err = new Error(
      `Mini App entryKey is not in the allowlist: ${entryKey}. Refusing dynamic import.`
    );
    err.code = 'MINI_APP_LOADER_DENIED';
    throw err;
  }
  const factory = APPROVED_LOADERS[entryKey];
  const mod = await factory();
  return {
    manifest,
    module: mod?.default || mod,
  };
}

/**
 * Test helper — inject a mock loader (NODE_ENV=test only).
 * @param {string} entryKey
 * @param {() => Promise<any>} factory
 */
export function __testRegisterLoader(entryKey, factory) {
  if (process.env.NODE_ENV !== 'test' && process.env.DYNAXIS_ALLOW_TEST_LOADERS !== '1') {
    throw new Error('Test loaders only allowed in test environment');
  }
  APPROVED_LOADERS[entryKey] = factory;
}

export function __testClearExtraLoaders() {
  const keep = new Set([
    'dynaxis.example',
    'dynaxis.headshot',
    'dynaxis.character-studio',
    'dynaxis.product-studio',
    'dynaxis.brand-studio',
    'dynaxis.campaign-studio',
    'dynaxis.creative-editor',
    'dynaxis.design-library',
  ]);
  for (const key of Object.keys(APPROVED_LOADERS)) {
    if (!keep.has(key)) delete APPROVED_LOADERS[key];
  }
}
