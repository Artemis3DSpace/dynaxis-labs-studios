/**
 * Register first-party Mini Apps into the Dynaxis registry.
 * Catalogue/external SamurAIGPT apps are NOT registered as integrated modules
 * unless migrated (e.g. AI Headshot in Phase 5A).
 */

import { miniAppRegistry } from './registry.js';
import { exampleMiniAppManifest } from '../../../packages/mini-apps/example/manifest.js';
import { headshotMiniAppManifest } from '../../../packages/mini-apps/headshot/manifest.js';
import { characterStudioMiniAppManifest } from '../../../packages/mini-apps/character-studio/manifest.js';
import { productStudioMiniAppManifest } from '../../../packages/mini-apps/product-studio/manifest.js';
import { brandStudioMiniAppManifest } from '../../../packages/mini-apps/brand-studio/manifest.js';
import { campaignStudioMiniAppManifest } from '../../../packages/mini-apps/campaign-studio/manifest.js';
import { creativeEditorMiniAppManifest } from '../../../packages/mini-apps/creative-editor/manifest.js';
import { designLibraryMiniAppManifest } from '../../../packages/mini-apps/design-library/manifest.js';

let bootstrapped = false;

export function bootstrapMiniAppRegistry() {
  if (bootstrapped) return miniAppRegistry;
  if (!miniAppRegistry.has(exampleMiniAppManifest.id)) {
    miniAppRegistry.register(exampleMiniAppManifest);
  }
  if (!miniAppRegistry.has(headshotMiniAppManifest.id)) {
    miniAppRegistry.register(headshotMiniAppManifest);
  }
  if (!miniAppRegistry.has(characterStudioMiniAppManifest.id)) {
    miniAppRegistry.register(characterStudioMiniAppManifest);
  }
  if (!miniAppRegistry.has(productStudioMiniAppManifest.id)) {
    miniAppRegistry.register(productStudioMiniAppManifest);
  }
  if (!miniAppRegistry.has(brandStudioMiniAppManifest.id)) {
    miniAppRegistry.register(brandStudioMiniAppManifest);
  }
  if (!miniAppRegistry.has(campaignStudioMiniAppManifest.id)) {
    miniAppRegistry.register(campaignStudioMiniAppManifest);
  }
  if (!miniAppRegistry.has(creativeEditorMiniAppManifest.id)) {
    miniAppRegistry.register(creativeEditorMiniAppManifest);
  }
  if (!miniAppRegistry.has(designLibraryMiniAppManifest.id)) {
    miniAppRegistry.register(designLibraryMiniAppManifest);
  }
  bootstrapped = true;
  return miniAppRegistry;
}

export function resetMiniAppBootstrap() {
  bootstrapped = false;
  miniAppRegistry.clear();
}
