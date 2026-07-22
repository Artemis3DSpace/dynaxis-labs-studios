/**
 * SSRF-safe controlled fetch for Composition export image embedding.
 * server-only
 */

import 'server-only';
import {
  assertSafeAnalysisUrl,
  assertSafeResolvedHost,
  isPrivateOrReservedIp,
} from '../brands/url-security.js';

export const MAX_ASSET_FETCH_BYTES = 15 * 1024 * 1024;
export const ASSET_FETCH_TIMEOUT_MS = 15000;
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.maxBytes]
 * @param {number} [opts.timeoutMs]
 */
export async function fetchAssetBytesSecure(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const maxBytes = opts.maxBytes ?? MAX_ASSET_FETCH_BYTES;
  const timeoutMs = opts.timeoutMs ?? ASSET_FETCH_TIMEOUT_MS;

  let parsed;
  try {
    parsed = assertSafeAnalysisUrl(url);
  } catch (err) {
    const e = new Error(err.message || 'URL not allowed');
    e.code = 'COMPOSITION_FETCH_URL_BLOCKED';
    e.status = 400;
    throw e;
  }

  await assertSafeResolvedHost(parsed.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(parsed.href, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        const e = new Error('Redirect without location');
        e.code = 'COMPOSITION_FETCH_REDIRECT_INVALID';
        e.status = 400;
        throw e;
      }
      return fetchAssetBytesSecure(new URL(loc, parsed.href).href, opts);
    }

    if (!res.ok) {
      const e = new Error(`Asset fetch failed: ${res.status}`);
      e.code = 'COMPOSITION_FETCH_FAILED';
      e.status = 502;
      throw e;
    }

    const mime = String(res.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      const e = new Error(`Unsupported MIME type: ${mime || 'unknown'}`);
      e.code = 'COMPOSITION_FETCH_MIME_REJECTED';
      e.status = 415;
      throw e;
    }

    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) {
      const e = new Error('Asset exceeds maximum download size');
      e.code = 'COMPOSITION_FETCH_TOO_LARGE';
      e.status = 413;
      throw e;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      const e = new Error('Asset exceeds maximum download size');
      e.code = 'COMPOSITION_FETCH_TOO_LARGE';
      e.status = 413;
      throw e;
    }

    return { bytes: buf, mimeType: mime };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Asset fetch timed out');
      e.code = 'COMPOSITION_FETCH_TIMEOUT';
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read bytes from a data: URL (tests / memory assets).
 * @param {string} url
 */
export function readDataUrlBytes(url) {
  const m = String(url).match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);
  if (!m) return null;
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  const payload = m[2];
  const bytes = url.includes(';base64,')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { bytes, mimeType: mime };
}

/**
 * Resolve asset URL to bytes with SSRF checks, Dynaxis blob URLs, or legacy data URLs.
 * @param {object} asset
 * @param {object} [opts]
 */
export async function resolveAssetImageBytes(asset, opts = {}) {
  const url = asset?.url;
  if (!url) {
    const e = new Error('Asset has no URL');
    e.code = 'ASSET_URL_MISSING';
    e.status = 422;
    throw e;
  }

  // Dynaxis-managed blob (memory / filesystem / private S3)
  if (url.startsWith('dynaxis-blob://')) {
    const { getBytesFromBlobUrl } = await import('../storage/register-rendered.js');
    const got = await getBytesFromBlobUrl(url, opts.blobStore);
    if (!got) {
      const e = new Error('Blob object not found');
      e.code = 'ASSET_BLOB_NOT_FOUND';
      e.status = 404;
      throw e;
    }
    if (!ALLOWED_IMAGE_MIMES.has(got.contentType) && got.contentType !== 'application/octet-stream') {
      // allow octet-stream when we know it's an image asset type
      if (asset.type !== 'image') {
        const e = new Error(`Unsupported blob MIME: ${got.contentType}`);
        e.code = 'COMPOSITION_FETCH_MIME_REJECTED';
        e.status = 415;
        throw e;
      }
    }
    return {
      bytes: got.bytes,
      mimeType: got.contentType === 'application/octet-stream' ? 'image/png' : got.contentType,
    };
  }

  // Object key in metadata (managed Asset) — preferred over raw URL when present
  const objectKey = asset?.metadata?.storage?.objectKey;
  const storageProvider = asset?.metadata?.storage?.provider;
  if (objectKey && storageProvider && opts.preferBlobMeta !== false) {
    try {
      const { resolveAssetBlobStore } = await import('../storage/blob-store.js');
      const store =
        opts.blobStore ||
        (await resolveAssetBlobStore({ driver: storageProvider, forceNew: true }));
      const got = await store.get(objectKey);
      if (got) {
        return {
          bytes: got.bytes,
          mimeType:
            got.contentType === 'application/octet-stream'
              ? 'image/png'
              : got.contentType,
        };
      }
    } catch {
      /* fall through to URL strategies */
    }
  }

  // Legacy data URLs (external test fixtures / pre-6E.1 Assets) — still readable for embedding
  if (url.startsWith('data:')) {
    const data = readDataUrlBytes(url);
    if (!data) {
      const e = new Error('Invalid data URL');
      e.code = 'ASSET_DATA_URL_INVALID';
      e.status = 422;
      throw e;
    }
    if (!ALLOWED_IMAGE_MIMES.has(data.mimeType)) {
      const e = new Error(`Unsupported data URL MIME: ${data.mimeType}`);
      e.code = 'COMPOSITION_FETCH_MIME_REJECTED';
      e.status = 415;
      throw e;
    }
    return data;
  }
  return fetchAssetBytesSecure(url, opts);
}

/**
 * @param {Buffer} bytes
 * @param {string} mimeType
 */
export function bytesToDataUri(bytes, mimeType) {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

export { isPrivateOrReservedIp };
