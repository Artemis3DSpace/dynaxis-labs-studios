/**
 * Dynaxis Mini App SDK — public contracts for trusted first-party modules.
 *
 * Import from `@/lib/dynaxis/mini-apps` (or this index) in Mini Apps and host code.
 * Do not import database clients, secrets, or unrestricted filesystem APIs.
 */

export {
  MINI_APP_PERMISSIONS,
  MINI_APP_STATUSES,
  MINI_APP_MODULE_TYPES,
  MINI_APP_CATEGORIES,
  ASSET_SEMANTIC_ROLES,
  isMiniAppPermission,
  hasPermission,
} from './permissions.js';

export {
  miniAppManifestSchema,
  assetInputSpecSchema,
  parseMiniAppManifest,
  safeParseMiniAppManifest,
  validateManifestConsistency,
} from './manifest.js';

export {
  miniAppGenerationRequestSchema,
  referenceAssetSchema,
  parseGenerationRequest,
} from './generation-request.js';

export {
  MiniAppRegistry,
  miniAppRegistry,
  createMiniAppRegistry,
} from './registry.js';

export {
  loadMiniApp,
  listApprovedLoaderKeys,
  isApprovedLoaderKey,
} from './loader.js';

export {
  createMiniAppRuntime,
  MiniAppPermissionError,
} from './runtime.js';

export { checkMiniAppAvailability } from './availability.js';

export { bootstrapMiniAppRegistry, resetMiniAppBootstrap } from './bootstrap.js';

export {
  executeMiniAppMuapiGeneration,
  buildProviderPayload,
  collectOutputUrls,
} from './execute-generation.js';

/**
 * Feature Registry vs Mini App Registry
 * -------------------------------------
 * Feature Registry (`lib/dynaxis/features.js`): top-level Dynaxis product capabilities
 * (Image Studio, Workflows, Agents, Apps surface, …).
 *
 * Mini App Registry: specialised modules hosted under Apps. They consume Projects,
 * Assets, Generations, and Jobs via the Mini App runtime — they do not replace
 * Feature Registry entries for Create/Build nav.
 */
