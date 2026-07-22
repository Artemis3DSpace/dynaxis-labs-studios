/**
 * Deterministic provider registry with no hidden global state.
 */

import { normalizeProviderId } from '../types.js';
import { validateGenerationProvider, describeGenerationProvider } from './contract.js';
import { providerNotFoundError } from './errors.js';

export class ProviderRegistry {
  /**
   * @param {Array<import('./contract.js').GenerationProvider>} [providers]
   */
  constructor(providers = []) {
    this.providers = new Map();
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /**
   * @param {import('./contract.js').GenerationProvider} provider
   */
  register(provider) {
    const valid = validateGenerationProvider(provider);
    const providerId = normalizeProviderId(valid.providerId);
    if (this.providers.has(providerId)) {
      throw Object.assign(new Error(`Generation provider already registered: ${providerId}`), {
        code: 'PROVIDER_ALREADY_REGISTERED',
        providerId,
        status: 500,
      });
    }
    this.providers.set(providerId, valid);
    return valid;
  }

  /**
   * @param {import('./contract.js').GenerationProvider} provider
   */
  replace(provider) {
    const valid = validateGenerationProvider(provider);
    this.providers.set(normalizeProviderId(valid.providerId), valid);
    return valid;
  }

  /**
   * @param {string} providerId
   */
  get(providerId) {
    const id = normalizeProviderId(providerId);
    if (!id) return null;
    return this.providers.get(id) || null;
  }

  /**
   * @param {string} providerId
   */
  require(providerId) {
    const id = normalizeProviderId(providerId);
    if (!id || !this.providers.has(id)) {
      throw providerNotFoundError(String(providerId || ''));
    }
    return this.providers.get(id);
  }

  /**
   * @param {string} providerId
   */
  has(providerId) {
    return this.get(providerId) != null;
  }

  list() {
    return [...this.providers.values()]
      .map(describeGenerationProvider)
      .sort((a, b) => a.providerId.localeCompare(b.providerId));
  }
}

/**
 * @param {Array<import('./contract.js').GenerationProvider>} [providers]
 */
export function createProviderRegistry(providers = []) {
  return new ProviderRegistry(providers);
}
