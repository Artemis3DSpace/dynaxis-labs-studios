/**
 * PNG validation + SHA-256 checksum for rendered Asset bytes (server-only).
 */

import 'server-only';
import { createHash } from 'node:crypto';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Hard cap on exported PNG payload (25 MiB). */
export const MAX_PNG_BYTES = 25 * 1024 * 1024;

/** Hard cap on total pixels (matches COMPOSITION_MAX_CANVAS_PX^2). */
export const MAX_PNG_PIXELS = 4096 * 4096;

/**
 * @param {Buffer} bytes
 * @returns {string}
 */
export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Validate rendered PNG before blob storage.
 * @param {Buffer} bytes
 * @param {{ expectedWidth?: number, expectedHeight?: number, maxBytes?: number, maxPixels?: number }} [opts]
 * @returns {{ byteSize: number, checksumSha256: string, mimeType: 'image/png' }}
 */
export function validateRenderedPng(bytes, opts = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    const e = new Error('Rendered PNG is empty');
    e.code = 'PNG_EMPTY';
    e.status = 422;
    throw e;
  }

  const maxBytes = opts.maxBytes ?? MAX_PNG_BYTES;
  if (bytes.length > maxBytes) {
    const e = new Error(`PNG exceeds maximum size (${maxBytes} bytes)`);
    e.code = 'PNG_TOO_LARGE';
    e.status = 413;
    throw e;
  }

  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const e = new Error('Invalid PNG signature');
    e.code = 'PNG_INVALID_SIGNATURE';
    e.status = 422;
    throw e;
  }

  // IHDR: length(4) + 'IHDR'(4) + width(4) + height(4) starts at offset 8
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) {
    const e = new Error('PNG has invalid dimensions');
    e.code = 'PNG_INVALID_DIMENSIONS';
    e.status = 422;
    throw e;
  }

  const maxPixels = opts.maxPixels ?? MAX_PNG_PIXELS;
  if (width * height > maxPixels) {
    const e = new Error('PNG exceeds maximum pixel count');
    e.code = 'PNG_TOO_MANY_PIXELS';
    e.status = 413;
    throw e;
  }

  if (opts.expectedWidth != null && width !== opts.expectedWidth) {
    const e = new Error(
      `PNG width mismatch: expected ${opts.expectedWidth}, got ${width}`
    );
    e.code = 'PNG_WIDTH_MISMATCH';
    e.status = 422;
    throw e;
  }
  if (opts.expectedHeight != null && height !== opts.expectedHeight) {
    const e = new Error(
      `PNG height mismatch: expected ${opts.expectedHeight}, got ${height}`
    );
    e.code = 'PNG_HEIGHT_MISMATCH';
    e.status = 422;
    throw e;
  }

  return {
    byteSize: bytes.length,
    checksumSha256: sha256Hex(bytes),
    mimeType: /** @type {const} */ ('image/png'),
    width,
    height,
  };
}
