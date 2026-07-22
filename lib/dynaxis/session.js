/**
 * Dynaxis Labs Studios — session / API credential access.
 *
 * Phase 2–3 scope: one documented client entry point for the MuAPI access key.
 * Full Dynaxis identity (accounts, orgs, SSO) remains deferred.
 *
 * Cookie sync remains intentional: Next.js agent SSR pages read `muapi_key`
 * from cookies. API route proxies intentionally do NOT trust cookies
 * (x-api-key header only). Platform APIs also use x-api-key → owner_ref hash.
 */

import { DYNAXIS_PRODUCT } from './product.js';

const { apiKeyStorageKey, designAgentTokenKey, cookieName, cookieMaxAgeSeconds } =
  DYNAXIS_PRODUCT.session;

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * @returns {string | null}
 */
export function getApiKey() {
  if (!canUseDom()) return null;
  return window.localStorage.getItem(apiKeyStorageKey);
}

/**
 * Persist API key to localStorage and sync the agent-SSR cookie + Design Agent token mirror.
 * @param {string} key
 */
export function setApiKey(key) {
  if (!canUseDom()) return;
  const trimmed = String(key || '').trim();
  if (!trimmed) return;
  window.localStorage.setItem(apiKeyStorageKey, trimmed);
  // Design Agent CreativeCanvas historically reads `token`
  window.localStorage.setItem(designAgentTokenKey, trimmed);
  document.cookie = `${cookieName}=${encodeURIComponent(trimmed)}; path=/; max-age=${cookieMaxAgeSeconds}; SameSite=Lax`;
}

/**
 * Clear credential material used by the shell and agent SSR.
 */
export function clearApiKey() {
  if (!canUseDom()) return;
  window.localStorage.removeItem(apiKeyStorageKey);
  window.localStorage.removeItem(designAgentTokenKey);
  document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Read key from cookie (client). Prefer getApiKey() for localStorage as source of truth.
 * @returns {string | null}
 */
export function getApiKeyFromCookie() {
  if (!canUseDom()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolve the best available client credential (localStorage first, then cookie).
 * @returns {string | null}
 */
export function resolveClientApiKey() {
  return getApiKey() || getApiKeyFromCookie();
}

export const SESSION_STORAGE_KEYS = {
  apiKeyStorageKey,
  designAgentTokenKey,
  cookieName,
};
