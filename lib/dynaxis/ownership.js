/**
 * Dynaxis ownership / access boundary (Phase 3).
 *
 * Current identity is MuAPI API-key session only. We never store the raw key.
 * ownerRef is a stable opaque hash suitable for later migration to Dynaxis user IDs
 * without destructive schema redesign (column remains text; prefix encodes scheme).
 *
 * Limitations (documented):
 * - Anyone with the same API key shares the same ownerRef (expected for MuAPI keys).
 * - No workspace/org RBAC yet.
 * - Preview keys are isolated under a dedicated namespace.
 */

import 'server-only';
import { createHash } from 'node:crypto';

export const OWNER_REF_SCHEME = 'ak_sha256';
export const LOCAL_PREVIEW_KEY = 'dynaxis-local-preview';

/**
 * @param {string} apiKey
 * @returns {string} opaque owner reference
 */
export function ownerRefFromApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new Error('[Dynaxis] ownerRef requires a non-empty API key');
  }
  if (key === LOCAL_PREVIEW_KEY) {
    return `${OWNER_REF_SCHEME}:preview:local`;
  }
  const digest = createHash('sha256').update(key, 'utf8').digest('hex');
  return `${OWNER_REF_SCHEME}:${digest}`;
}

/**
 * Extract API key from a Request / Headers.
 * @param {Request | { headers: Headers }} request
 * @returns {string | null}
 */
export function getApiKeyFromRequest(request) {
  const headers = request.headers;
  const key = headers.get('x-api-key') || headers.get('X-Api-Key');
  if (!key) return null;
  const trimmed = String(key).trim();
  return trimmed || null;
}

/**
 * Resolve ownerRef from request or throw 401-ready error.
 * @param {Request} request
 * @returns {{ apiKey: string, ownerRef: string }}
 */
export function requireOwnerFromRequest(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    const err = new Error('Missing x-api-key');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { apiKey, ownerRef: ownerRefFromApiKey(apiKey) };
}

/**
 * Deterministic migration key for localStorage history import (dedupe).
 * @param {{ studioKey: string, url: string, createdAt?: string|number|null }} entry
 * @returns {string}
 */
export function migrationKeyForLocalHistory(entry) {
  const studioKey = String(entry.studioKey || '');
  const url = String(entry.url || '');
  const createdAt = entry.createdAt == null ? '' : String(entry.createdAt);
  const digest = createHash('sha256')
    .update(`${studioKey}\n${url}\n${createdAt}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `hg_import:${digest}`;
}
