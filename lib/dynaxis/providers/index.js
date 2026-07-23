/**
 * Production provider registry.
 *
 * Phase 7B registers only MuAPI. Future provider IDs are vocabulary constants,
 * not production registrations.
 */

import { createMuAPIProvider, MuAPIProvider } from './muapi.js';
import { createProviderRegistry } from './registry.js';

export * from './capabilities.js';
export * from './common.js';
export * from './contract.js';
export * from './errors.js';
export * from './registry.js';
export { createMuAPIProvider, MuAPIProvider } from './muapi.js';

export function createProductionProviderRegistry(opts = {}) {
  return createProviderRegistry([createMuAPIProvider(opts.muapi || {})]);
}

let productionRegistry = null;

export function getProductionProviderRegistry() {
  if (!productionRegistry) {
    productionRegistry = createProductionProviderRegistry();
  }
  return productionRegistry;
}
