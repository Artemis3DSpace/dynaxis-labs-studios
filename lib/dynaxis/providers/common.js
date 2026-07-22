/**
 * Provider-neutral generation helpers.
 *
 * These helpers intentionally know nothing about a specific provider's business
 * model. Provider adapters may use them after translating provider-specific
 * response shapes into Dynaxis-safe payloads.
 */

export const PROVIDER_PAYLOAD_MAX_JSON_BYTES = 8000;

const SENSITIVE_KEYS = new Set([
  'api_key',
  'apikey',
  'api_secret',
  'apisecret',
  'authorization',
  'credentials',
  'token',
  'access_token',
  'refresh_token',
]);

const MEDIA_KEYS = new Set([
  'url',
  'uri',
  'output',
  'outputs',
  'images',
  'image',
  'video',
  'videos',
  'audio',
  'audios',
  'result',
  'results',
  'media',
  'files',
]);

/**
 * Provider-neutral status normalization to Dynaxis lifecycle vocabulary.
 * @param {string | null | undefined} raw
 * @returns {import('../types.js').JobStatus | 'unknown'}
 */
export function normaliseProviderStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return 'unknown';
  if (s === 'queued' || s === 'pending' || s === 'created') return 'queued';
  if (s === 'submitted' || s === 'starting') return 'submitted';
  if (s === 'processing' || s === 'running' || s === 'in_progress' || s === 'in-progress') {
    return 'processing';
  }
  if (s === 'completed' || s === 'succeeded' || s === 'success' || s === 'done') {
    return 'succeeded';
  }
  if (s === 'failed' || s === 'error' || s === 'errored') return 'failed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'unknown';
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isHttpOutputUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract HTTP(S) output URLs from common provider media containers.
 * @param {unknown} data
 * @returns {string[]}
 */
export function extractOutputUrls(data) {
  const urls = [];
  const seenObjects = new WeakSet();

  const push = (value) => {
    if (isHttpOutputUrl(value)) urls.push(String(value));
  };

  const visit = (value, depth = 0, keyHint = '') => {
    if (depth > 8 || value == null) return;
    if (typeof value === 'string') {
      if (!keyHint || MEDIA_KEYS.has(String(keyHint).toLowerCase())) push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, keyHint);
      return;
    }
    if (typeof value !== 'object') return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    for (const key of ['url', 'uri']) {
      if (typeof value[key] === 'string') push(value[key]);
    }

    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase();
      if (MEDIA_KEYS.has(normalized) || depth > 0) {
        visit(child, depth + 1, normalized);
      }
    }
  };

  visit(data);
  return [...new Set(urls)];
}

/**
 * Strip secrets and bound provider payloads before persistence.
 * @param {unknown} data
 * @param {{ maxBytes?: number }} [opts]
 * @returns {Record<string, unknown>}
 */
export function safeProviderPayload(data, opts = {}) {
  const maxBytes = opts.maxBytes || PROVIDER_PAYLOAD_MAX_JSON_BYTES;
  if (!data || typeof data !== 'object') return {};
  const seen = new WeakSet();

  const sanitize = (value, key = '', depth = 0) => {
    const normalizedKey = String(key).toLowerCase();
    if (SENSITIVE_KEYS.has(normalizedKey)) return '[redacted]';
    if (value == null) return value;
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (typeof value === 'bigint') return String(value);
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[circular]';
    if (depth > 8) return '[max-depth]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item, key, depth + 1));
    }
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitize(childValue, childKey, depth + 1);
      if (sanitized !== undefined) out[childKey] = sanitized;
    }
    return out;
  };

  try {
    const sanitized = sanitize(data);
    const json = JSON.stringify(sanitized);
    if (json.length > maxBytes) {
      const keys = sanitized && typeof sanitized === 'object' ? Object.keys(sanitized).slice(0, 40) : [];
      return { truncated: true, bytes: json.length, maxBytes, keys };
    }
    return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? sanitized
      : { value: sanitized };
  } catch (err) {
    return {
      sanitized: false,
      error: 'PROVIDER_PAYLOAD_SANITIZE_FAILED',
      message: String(err?.message || err).slice(0, 200),
    };
  }
}
