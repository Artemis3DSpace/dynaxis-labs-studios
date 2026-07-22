/**
 * Dynaxis Labs Studios — platform service façade (Phase 3 implementations).
 * Server-only module. Do not import from client components.
 */

import 'server-only';

export {
  PLATFORM_SERVICE_STATUS,
  PLATFORM_SERVICE_NOTES,
} from './platform-status.js';

import { projectServiceImpl } from './services/projects.js';
import { assetServiceImpl } from './services/assets.js';
import { generationServiceImpl } from './services/generations.js';
import { jobServiceImpl } from './services/jobs.js';
import { generationGatewayServiceImpl } from './services/generation-gateway.js';
import { getProductionProviderRegistry } from './providers/index.js';
import { getApiKey } from './session.js';
import { ownerRefFromApiKey } from './ownership.js';
import { isPlatformDbConfigured, isMemoryDriverAllowed } from './db/client.js';

function notImplemented(service, method) {
  return async () => {
    throw new Error(
      `[Dynaxis] ${service}.${method} is not implemented. See PLATFORM_SERVICE_NOTES.`
    );
  };
}

/** Soft identity bridge — not a full Dynaxis account system */
export const identityService = {
  getCurrentUser: async () => {
    if (typeof window === 'undefined') return null;
    const key = getApiKey();
    if (!key) return null;
    return {
      id: ownerRefFromApiKey(key),
      displayName: null,
      identityScheme: 'muapi_api_key_hash',
    };
  },
  isAuthenticated: async () => {
    if (typeof window === 'undefined') return false;
    return Boolean(getApiKey());
  },
};

export const workspaceService = {
  getCurrentWorkspace: notImplemented('workspace', 'getCurrentWorkspace'),
  listWorkspaces: notImplemented('workspace', 'listWorkspaces'),
};

export const projectService = {
  create: (ownerRef, input) => projectServiceImpl.create(ownerRef, input),
  get: (ownerRef, id) => projectServiceImpl.get(ownerRef, id),
  list: (ownerRef, opts) => projectServiceImpl.list(ownerRef, opts),
  update: (ownerRef, id, input) => projectServiceImpl.update(ownerRef, id, input),
  archive: (ownerRef, id) => projectServiceImpl.archive(ownerRef, id),
  ensureDefault: (ownerRef) => projectServiceImpl.ensureDefault(ownerRef),
  resolve: (ownerRef, projectId) => projectServiceImpl.resolve(ownerRef, projectId),
};

export const assetService = {
  register: (ownerRef, input) => assetServiceImpl.register(ownerRef, input),
  get: (ownerRef, id) => assetServiceImpl.get(ownerRef, id),
  list: (ownerRef, opts) => assetServiceImpl.list(ownerRef, opts),
  upload: async (ownerRef, input) => {
    const { storeAndRegisterRenderedPng } = await import('./storage/register-rendered.js');
    if (!input?.bytes) {
      throw new Error('[Dynaxis] asset.upload requires bytes Buffer');
    }
    return storeAndRegisterRenderedPng(ownerRef, {
      bytes: input.bytes,
      projectId: input.projectId,
      width: input.width,
      height: input.height,
      provider: input.provider || 'dynaxis-upload',
      metadata: input.metadata,
      blobStore: input.blobStore,
    });
  },
};

export const historyService = {
  list: (ownerRef, opts) => generationServiceImpl.list(ownerRef, opts),
  record: (ownerRef, input) => generationServiceImpl.create(ownerRef, input),
  get: (ownerRef, id) => generationServiceImpl.get(ownerRef, id),
};

export const billingService = {
  getSubscription: notImplemented('billing', 'getSubscription'),
};

export const creditsService = {
  getBalance: notImplemented('credits', 'getBalance (use studio getUserBalance)'),
};

export const storageService = {
  upload: async (input) => {
    const { resolveAssetBlobStore, buildObjectKey } = await import('./storage/blob-store.js');
    const store = await resolveAssetBlobStore();
    return store.put(input.bytes, {
      key: input.key || buildObjectKey(input),
      contentType: input.contentType || 'application/octet-stream',
      checksumSha256: input.checksumSha256,
      metadata: input.metadata,
    });
  },
};

export const jobService = {
  submit: notImplemented('job', 'submit (use lifecycle.start + MuAPI client)'),
  get: (ownerRef, id) => jobServiceImpl.get(ownerRef, id),
  cancel: notImplemented('job', 'cancel (MuAPI cancel not universally supported)'),
  create: (ownerRef, input) => jobServiceImpl.create(ownerRef, input),
  update: (ownerRef, id, patch) => jobServiceImpl.update(ownerRef, id, patch),
};

export const modelGateway = {
  createGenerationGateway: (opts) => generationGatewayServiceImpl.create(opts),
  parseRequest: (input) => generationGatewayServiceImpl.parseRequest(input),
  parseResult: (input) => generationGatewayServiceImpl.parseResult(input),
  submit: notImplemented('modelGateway', 'submit (Phase 7E durable execution not implemented)'),
  getModel: () => null,
  listModels: () => [],
};

export const providerRegistryService = {
  list: () => getProductionProviderRegistry().list(),
  get: (providerId) => getProductionProviderRegistry().get(providerId),
  has: (providerId) => getProductionProviderRegistry().has(providerId),
  require: (providerId) => getProductionProviderRegistry().require(providerId),
};

export function getPlatformPersistenceMode() {
  if (isMemoryDriverAllowed()) return 'memory';
  if (isPlatformDbConfigured()) return 'postgresql';
  return 'unavailable';
}
