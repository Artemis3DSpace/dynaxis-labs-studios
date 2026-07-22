/**
 * Persist rendered Asset bytes via Asset Blob Store + register Dynaxis Asset.
 * server-only — never returns a data: URL for production export.
 */

import 'server-only';
import { registerAsset } from '../services/assets.js';
import {
  buildObjectKey,
  resolveAssetBlobStore,
  parseBlobUrl,
} from './blob-store.js';
import { validateRenderedPng } from './png-validate.js';

/**
 * @param {string} ownerRef
 * @param {object} opts
 * @param {Buffer} opts.bytes
 * @param {string} opts.projectId
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {object} [opts.metadata]
 * @param {string} [opts.provider]
 * @param {import('./blob-store.js').AssetBlobStore} [opts.blobStore]
 */
export async function storeAndRegisterRenderedPng(ownerRef, opts) {
  const validated = validateRenderedPng(opts.bytes, {
    expectedWidth: opts.enforceDimensions === false ? undefined : opts.width,
    expectedHeight: opts.enforceDimensions === false ? undefined : opts.height,
  });

  const store = opts.blobStore || (await resolveAssetBlobStore());
  const key = buildObjectKey({
    ownerRef,
    projectId: opts.projectId,
    filename: `${Date.now()}-${validated.checksumSha256.slice(0, 12)}.png`,
  });

  const put = await store.put(opts.bytes, {
    key,
    contentType: 'image/png',
    checksumSha256: validated.checksumSha256,
    metadata: {
      ownerRef,
      projectId: opts.projectId,
    },
  });

  if (String(put.url || '').startsWith('data:')) {
    const e = new Error('Blob store returned a data URL — not permitted for Asset registration');
    e.code = 'ASSET_STORAGE_DATA_URL_FORBIDDEN';
    e.status = 500;
    throw e;
  }

  const asset = await registerAsset(ownerRef, {
    projectId: opts.projectId,
    type: 'image',
    source: 'generated',
    provider: opts.provider || 'dynaxis-composition',
    model: null,
    url: put.url,
    mimeType: 'image/png',
    width: opts.width,
    height: opts.height,
    metadata: {
      ...(opts.metadata || {}),
      storage: {
        provider: put.provider,
        objectKey: put.key,
        bucket: put.bucket || null,
        byteSize: put.byteSize,
        checksumSha256: put.checksumSha256,
        contentType: put.contentType,
        etag: put.etag || null,
      },
    },
  });

  return { asset, put, validated };
}

/**
 * Resolve bytes for a Dynaxis-managed blob Asset URL.
 * @param {string} url
 * @param {import('./blob-store.js').AssetBlobStore} [blobStore]
 */
export async function getBytesFromBlobUrl(url, blobStore) {
  const parsed = parseBlobUrl(url);
  if (!parsed) return null;
  const store = blobStore || (await resolveAssetBlobStore({ driver: parsed.provider }));
  if (store.provider !== parsed.provider) {
    // Prefer store that matches URL provider when possible
    const matched = await resolveAssetBlobStore({ driver: parsed.provider, forceNew: true });
    return matched.get(parsed.key);
  }
  return store.get(parsed.key);
}
