/**
 * Dynaxis Asset Blob Store — generic binary object storage boundary (server-only).
 *
 * Providers: memory (tests), filesystem (local dev), s3 (production S3-compatible).
 * Never persist large binary content in PostgreSQL.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';

export const BLOB_SCHEME = 'dynaxis-blob';

/**
 * @typedef {'memory' | 'filesystem' | 's3'} BlobStoreProvider
 *
 * @typedef {{
 *   key: string,
 *   url: string,
 *   contentType: string,
 *   byteSize: number,
 *   checksumSha256: string,
 *   provider: BlobStoreProvider,
 *   bucket?: string | null,
 *   etag?: string | null,
 * }} BlobPutResult
 *
 * @typedef {{
 *   key: string,
 *   contentType: string,
 *   byteSize: number,
 *   checksumSha256?: string | null,
 *   provider: BlobStoreProvider,
 * }} BlobMetadata
 *
 * @typedef {{
 *   provider: BlobStoreProvider,
 *   put: (bytes: Buffer, opts: {
 *     key?: string,
 *     contentType: string,
 *     checksumSha256?: string,
 *     metadata?: Record<string, string>,
 *   }) => Promise<BlobPutResult>,
 *   get: (key: string) => Promise<{ bytes: Buffer, contentType: string } | null>,
 *   getMetadata: (key: string) => Promise<BlobMetadata | null>,
 *   delete?: (key: string) => Promise<boolean>,
 * }} AssetBlobStore
 */

/**
 * Build a safe object key under an optional prefix.
 * Rejects path traversal and absolute paths.
 * @param {object} parts
 * @param {string} [parts.prefix]
 * @param {string} [parts.ownerRef]
 * @param {string} [parts.projectId]
 * @param {string} [parts.filename]
 */
export function buildObjectKey({
  prefix = 'dynaxis',
  ownerRef = 'anon',
  projectId = 'project',
  filename,
} = {}) {
  const safe = (s) =>
    String(s || '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'x';
  const name = filename || `${randomUUID()}.png`;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    const e = new Error('Invalid object key filename');
    e.code = 'BLOB_KEY_INVALID';
    e.status = 400;
    throw e;
  }
  const pref = safe(prefix).replace(/\./g, '-');
  return `${pref}/assets/${safe(ownerRef)}/${safe(projectId)}/${name}`;
}

/**
 * @param {BlobStoreProvider} provider
 * @param {string} key
 */
export function blobUrlForKey(provider, key) {
  return `${BLOB_SCHEME}://${provider}/${key}`;
}

/**
 * @param {string} url
 * @returns {{ provider: BlobStoreProvider, key: string } | null}
 */
export function parseBlobUrl(url) {
  const s = String(url || '');
  if (!s.startsWith(`${BLOB_SCHEME}://`)) return null;
  const rest = s.slice(`${BLOB_SCHEME}://`.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  const provider = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (!provider || !key || key.includes('..')) return null;
  if (!['memory', 'filesystem', 's3'].includes(provider)) return null;
  return { provider: /** @type {BlobStoreProvider} */ (provider), key };
}

function unavailable(message) {
  const e = new Error(message || 'Asset storage is unavailable');
  e.code = 'ASSET_STORAGE_UNAVAILABLE';
  e.status = 503;
  return e;
}

/**
 * Resolve configured blob store from environment.
 * Production requires S3. Tests/dev may use memory or filesystem explicitly.
 *
 * @param {object} [overrides]
 * @returns {Promise<AssetBlobStore>}
 */
export async function getAssetBlobStore(overrides = {}) {
  const driver =
    overrides.driver ||
    process.env.DYNAXIS_ASSET_STORAGE ||
    (process.env.NODE_ENV === 'test' || process.env.DYNAXIS_PLATFORM_DRIVER === 'memory'
      ? 'memory'
      : process.env.NODE_ENV === 'production'
        ? 's3'
        : 'filesystem');

  if (driver === 'memory') {
    const { createMemoryBlobStore } = await import('./memory-blob-store.js');
    return createMemoryBlobStore(overrides);
  }
  if (driver === 'filesystem') {
    const { createFilesystemBlobStore } = await import('./filesystem-blob-store.js');
    return createFilesystemBlobStore(overrides);
  }
  if (driver === 's3') {
    if (!process.env.DYNAXIS_S3_BUCKET && !overrides.bucket) {
      throw unavailable(
        'Production asset storage requires DYNAXIS_S3_BUCKET (and credentials). Data-URL fallback is disabled.'
      );
    }
    const { createS3BlobStore } = await import('./s3-blob-store.js');
    return createS3BlobStore(overrides);
  }

  throw unavailable(`Unknown asset storage driver: ${driver}`);
}

/**
 * Reset singleton caches (tests).
 */
let _cached = null;
let _cachedDriver = null;

export async function resolveAssetBlobStore(overrides = {}) {
  if (overrides.store) return overrides.store;
  const driver =
    overrides.driver ||
    process.env.DYNAXIS_ASSET_STORAGE ||
    (process.env.NODE_ENV === 'test' || process.env.DYNAXIS_PLATFORM_DRIVER === 'memory'
      ? 'memory'
      : null);
  if (!overrides.forceNew && _cached && _cachedDriver === driver && !overrides.bucket) {
    return _cached;
  }
  const store = await getAssetBlobStore(overrides);
  if (!overrides.forceNew) {
    _cached = store;
    _cachedDriver = store.provider;
  }
  return store;
}

export function resetAssetBlobStoreCache() {
  _cached = null;
  _cachedDriver = null;
}

export { unavailable as assetStorageUnavailable };
