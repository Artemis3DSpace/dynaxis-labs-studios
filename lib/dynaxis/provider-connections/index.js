/**
 * ProviderConnection server-only entry point (WP-7D-06).
 *
 * Routes and other server callers should import from here rather than reaching
 * into individual modules, so the secret runtime (`../secrets/**`) stays
 * unreachable from route code.
 *
 * Note: no secret primitive is re-exported. `sealSecret`, `openSecret`, and
 * key resolution remain importable only by the service/materialization
 * boundary itself.
 */

import 'server-only';
import { getDb } from '../db/client.js';
import { createDrizzleProviderConnectionRepository } from './repository.js';
import { createProviderConnectionService } from './service.js';

let defaultService = null;

/**
 * Lazily builds the Drizzle-backed service. Lazy so importing this module
 * never forces a database connection at build time.
 */
export function getProviderConnectionService() {
  if (!defaultService) {
    defaultService = createProviderConnectionService({
      repository: createDrizzleProviderConnectionRepository(getDb()),
    });
  }
  return defaultService;
}

/** Test/script hook: drops the cached service. */
export function resetProviderConnectionServiceForTests() {
  defaultService = null;
}

export {
  PROVIDER_CONNECTION_ERROR_CODES,
  ProviderConnectionError,
  providerConnectionError,
} from './errors.js';
export {
  PROVIDER_CONNECTION_HEALTH,
  PROVIDER_CONNECTION_HEALTH_VALUES,
  classifyConnectionHealth,
  getConnectionHealth,
  isUsableHealth,
  listConnectionHealth,
  toPublicConnectionHealth,
} from './health.js';
export { readProviderConnectionAudit, toPublicAuditEvent } from './audit-view.js';
export { assertCanonicalPrincipal } from './route-guard.js';
export { toPublicProviderConnection, toPublicProviderConnectionList } from './redaction.js';
export { createProviderConnectionService, ProviderConnectionService } from './service.js';
export { createDrizzleProviderConnectionRepository } from './repository.js';
export {
  DYNAXIS_MUAPI_PROVIDER_ID,
  dispatchWithProviderConnection,
  withMuapiCredential,
} from './resolver.js';
