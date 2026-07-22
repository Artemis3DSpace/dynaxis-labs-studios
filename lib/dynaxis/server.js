/**
 * Server-only Dynaxis platform exports.
 * Import from API routes / Node scripts only — not from client components.
 */

import 'server-only';

export * from './platform.js';
export { ownerRefFromApiKey, requireOwnerFromRequest, migrationKeyForLocalHistory } from './ownership.js';
export { getPlatformStore, PlatformPersistenceError, isPlatformDbConfigured } from './db/store.js';
export {
  createMuAPIProvider,
  MuAPIProvider,
  normaliseProviderStatus,
  extractOutputUrls,
  safeProviderPayload,
} from './providers/muapi.js';
export * as providerKernel from './providers/index.js';
export * from './providers/capabilities.js';
export * from './providers/common.js';
export * from './providers/contract.js';
export * from './providers/errors.js';
export * from './providers/registry.js';
export * as projectServiceModule from './services/projects.js';
export * as assetServiceModule from './services/assets.js';
export * as generationServiceModule from './services/generations.js';
export * as jobServiceModule from './services/jobs.js';
export * as lifecycleServiceModule from './services/lifecycle.js';
export * as generationGatewayModule from './services/generation-gateway.js';
export {
  createGenerationGateway,
  GenerationGateway,
  parseGenerationGatewayRequest,
  parseGenerationGatewayResult,
} from './services/generation-gateway.js';
export { importLocalHistory } from './services/history-compat.js';
