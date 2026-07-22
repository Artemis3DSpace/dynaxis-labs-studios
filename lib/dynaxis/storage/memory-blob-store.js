/**
 * In-memory Asset Blob Store — tests only (non-production).
 */

import 'server-only';
import { buildObjectKey, blobUrlForKey } from './blob-store.js';
import { sha256Hex } from './png-validate.js';

/**
 * @param {object} [opts]
 * @returns {import('./blob-store.js').AssetBlobStore}
 */
export function createMemoryBlobStore(opts = {}) {
  /** @type {Map<string, { bytes: Buffer, contentType: string, checksumSha256: string }>} */
  const map = opts.map || new Map();

  return {
    provider: /** @type {const} */ ('memory'),
    async put(bytes, putOpts = {}) {
      const key =
        putOpts.key ||
        buildObjectKey({
          prefix: opts.prefix || 'dynaxis-test',
          ownerRef: putOpts.metadata?.ownerRef,
          projectId: putOpts.metadata?.projectId,
        });
      const contentType = putOpts.contentType || 'application/octet-stream';
      const checksumSha256 = putOpts.checksumSha256 || sha256Hex(bytes);
      map.set(key, {
        bytes: Buffer.from(bytes),
        contentType,
        checksumSha256,
      });
      return {
        key,
        url: blobUrlForKey('memory', key),
        contentType,
        byteSize: bytes.length,
        checksumSha256,
        provider: 'memory',
        bucket: null,
        etag: checksumSha256.slice(0, 16),
      };
    },
    async get(key) {
      const row = map.get(key);
      if (!row) return null;
      return { bytes: Buffer.from(row.bytes), contentType: row.contentType };
    },
    async getMetadata(key) {
      const row = map.get(key);
      if (!row) return null;
      return {
        key,
        contentType: row.contentType,
        byteSize: row.bytes.length,
        checksumSha256: row.checksumSha256,
        provider: 'memory',
      };
    },
    async delete(key) {
      return map.delete(key);
    },
    /** @internal test helper */
    _map: map,
  };
}
