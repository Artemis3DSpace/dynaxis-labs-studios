/**
 * MuAPI provider adapter — GenerationProvider implementation.
 * Normalises MuAPI status/results for Dynaxis Jobs without replacing MuAPI.
 */

import { PROVIDER_MUAPI } from '../types.js';
import {
  extractOutputUrls,
  normaliseProviderStatus,
  safeProviderPayload,
} from './common.js';

const DEFAULT_MUAPI_HOST = 'https://api.muapi.ai';

/**
 * @typedef {Object} MuAPIProviderOptions
 * @property {string} [apiHost]
 * @property {typeof fetch} [fetchImpl]
 */

export class MuAPIProvider {
  /**
   * @param {MuAPIProviderOptions} [opts]
   */
  constructor(opts = {}) {
    this.providerId = PROVIDER_MUAPI;
    this.metadata = Object.freeze({
      displayName: 'MuAPI',
      description: 'Existing Dynaxis creative-generation provider adapter.',
    });
    this.capabilities = Object.freeze([]);
    this.features = Object.freeze({
      submit: true,
      retrieve: true,
      cancel: false,
      webhooks: false,
      uploads: false,
      modelDiscovery: false,
      costEstimation: false,
    });
    this.apiHost = (opts.apiHost || process.env.MUAPI_API_HOST || DEFAULT_MUAPI_HOST).replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl || fetch;
  }

  /**
   * Submit a generation request to MuAPI.
   * @param {{ apiKey: string, endpoint: string, payload: object }} input
   */
  async submit({ apiKey, endpoint, payload }) {
    const path = String(endpoint || '').replace(/^\//, '');
    const url = `${this.apiHost}/api/v1/${path}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const err = new Error(
        `MuAPI submit failed: ${response.status} ${String(text).slice(0, 200)}`
      );
      err.status = response.status;
      err.code = 'MUAPI_SUBMIT_FAILED';
      err.dynaxisProviderCode = response.status === 401 || response.status === 403
        ? 'PROVIDER_AUTH_FAILED'
        : response.status === 429
          ? 'PROVIDER_RATE_LIMITED'
          : 'PROVIDER_SUBMIT_FAILED';
      err.providerId = PROVIDER_MUAPI;
      err.operation = 'submit';
      err.retryable = response.status >= 500 || response.status === 429;
      err.providerPayload = safeProviderPayload(data);
      throw err;
    }
    const providerJobId = data.request_id || data.id || null;
    return {
      provider: PROVIDER_MUAPI,
      providerJobId,
      status: providerJobId ? 'submitted' : normaliseProviderStatus(data.status),
      raw: safeProviderPayload(data),
    };
  }

  /**
   * Poll / retrieve prediction result.
   * @param {{ apiKey: string, providerJobId: string }} input
   */
  async retrieve({ apiKey, providerJobId }) {
    const url = `${this.apiHost}/api/v1/predictions/${providerJobId}/result`;
    const response = await this.fetchImpl(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const err = new Error(
        `MuAPI poll failed: ${response.status} ${String(text).slice(0, 200)}`
      );
      err.status = response.status;
      err.code = 'MUAPI_POLL_FAILED';
      err.dynaxisProviderCode = response.status === 401 || response.status === 403
        ? 'PROVIDER_AUTH_FAILED'
        : response.status === 429
          ? 'PROVIDER_RATE_LIMITED'
          : 'PROVIDER_RETRIEVE_FAILED';
      err.providerId = PROVIDER_MUAPI;
      err.operation = 'retrieve';
      err.retryable = response.status >= 500;
      err.providerPayload = safeProviderPayload(data);
      throw err;
    }
    return this.normaliseResult(data);
  }

  /**
   * Cancel is not universally supported by MuAPI; expose honest no-op contract.
   * @returns {{ supported: false }}
   */
  async cancel() {
    return { supported: false, cancelled: false };
  }

  /**
   * @param {object} data
   */
  normaliseResult(data) {
    const dynaxisStatus = normaliseProviderStatus(data.status);
    const outputs = extractOutputUrls(data);
    return {
      provider: PROVIDER_MUAPI,
      status: dynaxisStatus,
      outputs,
      primaryUrl: outputs[0] || null,
      error: data.error || data.message || null,
      raw: safeProviderPayload(data),
    };
  }
}

export function createMuAPIProvider(opts) {
  return new MuAPIProvider(opts);
}

/** @type {import('../types.js').JobStatus | 'unknown'} */
export { extractOutputUrls, normaliseProviderStatus, safeProviderPayload };
