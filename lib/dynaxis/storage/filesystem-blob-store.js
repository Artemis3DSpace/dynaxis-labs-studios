/**
 * Filesystem Asset Blob Store — local development only (non-production).
 */

import 'server-only';
import { mkdir, writeFile, readFile, unlink, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { buildObjectKey, blobUrlForKey } from './blob-store.js';
import { sha256Hex } from './png-validate.js';

/**
 * @param {object} [opts]
 * @param {string} [opts.rootDir]
 * @returns {import('./blob-store.js').AssetBlobStore}
 */
export function createFilesystemBlobStore(opts = {}) {
  const rootDir = resolve(
    opts.rootDir ||
      process.env.DYNAXIS_ASSET_FS_ROOT ||
      join(process.cwd(), '.dynaxis-blob-store')
  );

  function safePath(key) {
    if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      const e = new Error('Invalid blob key');
      e.code = 'BLOB_KEY_INVALID';
      e.status = 400;
      throw e;
    }
    const full = resolve(join(rootDir, key));
    if (!full.startsWith(rootDir)) {
      const e = new Error('Blob path escapes storage root');
      e.code = 'BLOB_KEY_INVALID';
      e.status = 400;
      throw e;
    }
    return full;
  }

  return {
    provider: /** @type {const} */ ('filesystem'),
    async put(bytes, putOpts = {}) {
      const key =
        putOpts.key ||
        buildObjectKey({
          prefix: opts.prefix || 'dynaxis-dev',
          ownerRef: putOpts.metadata?.ownerRef,
          projectId: putOpts.metadata?.projectId,
        });
      const full = safePath(key);
      await mkdir(dirname(full), { recursive: true });
      const contentType = putOpts.contentType || 'application/octet-stream';
      const checksumSha256 = putOpts.checksumSha256 || sha256Hex(bytes);
      await writeFile(full, bytes);
      await writeFile(
        `${full}.meta.json`,
        JSON.stringify({ contentType, checksumSha256, byteSize: bytes.length })
      );
      return {
        key,
        url: blobUrlForKey('filesystem', key),
        contentType,
        byteSize: bytes.length,
        checksumSha256,
        provider: 'filesystem',
        bucket: null,
        etag: null,
      };
    },
    async get(key) {
      const full = safePath(key);
      try {
        await access(full);
      } catch {
        return null;
      }
      const bytes = await readFile(full);
      let contentType = 'application/octet-stream';
      try {
        const meta = JSON.parse(await readFile(`${full}.meta.json`, 'utf8'));
        contentType = meta.contentType || contentType;
      } catch {
        /* ignore */
      }
      return { bytes, contentType };
    },
    async getMetadata(key) {
      const full = safePath(key);
      try {
        await access(full);
      } catch {
        return null;
      }
      const bytes = await readFile(full);
      let contentType = 'application/octet-stream';
      let checksumSha256 = null;
      try {
        const meta = JSON.parse(await readFile(`${full}.meta.json`, 'utf8'));
        contentType = meta.contentType || contentType;
        checksumSha256 = meta.checksumSha256 || null;
      } catch {
        checksumSha256 = sha256Hex(bytes);
      }
      return {
        key,
        contentType,
        byteSize: bytes.length,
        checksumSha256,
        provider: 'filesystem',
      };
    },
    async delete(key) {
      const full = safePath(key);
      try {
        await unlink(full);
        try {
          await unlink(`${full}.meta.json`);
        } catch {
          /* ignore */
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}
