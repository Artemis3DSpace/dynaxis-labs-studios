/**
 * SSRF-safe URL validation for Brand website analysis.
 * Pure Node networking helpers — import only from server-side Brand analysis.
 *
 * Does NOT navigate. Callers must re-validate redirect targets and DNS results.
 */

import { isIP } from 'node:net';
import dns from 'node:dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
]);

const METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata',
  'metadata.google.internal',
]);

/**
 * @param {string} hostname
 */
export function isBlockedHostname(hostname) {
  const h = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (METADATA_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  return false;
}

/**
 * @param {string} ip
 */
export function isPrivateOrReservedIp(ip) {
  const version = isIP(ip);
  if (!version) return true;

  if (version === 4) {
    const parts = ip.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('ff')) return true; // multicast
  // IPv4-mapped
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateOrReservedIp(mapped[1]);
  return false;
}

/**
 * Validate a user-supplied analysis URL before DNS / navigation.
 * @param {string} raw
 * @returns {{ href: string, hostname: string, protocol: string }}
 */
export function assertSafeAnalysisUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || '').trim());
  } catch {
    const err = new Error('Invalid URL');
    err.code = 'BRAND_URL_INVALID';
    err.status = 400;
    throw err;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const err = new Error(`Unsupported URL scheme: ${parsed.protocol}`);
    err.code = 'BRAND_URL_SCHEME_DENIED';
    err.status = 400;
    throw err;
  }

  if (parsed.username || parsed.password) {
    const err = new Error('URLs with credentials are not allowed');
    err.code = 'BRAND_URL_CREDENTIALS_DENIED';
    err.status = 400;
    throw err;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(hostname)) {
    const err = new Error('Hostname is not allowed for Brand analysis');
    err.code = 'BRAND_URL_HOST_DENIED';
    err.status = 400;
    throw err;
  }

  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    const err = new Error('Private or reserved IP addresses are not allowed');
    err.code = 'BRAND_URL_IP_DENIED';
    err.status = 400;
    throw err;
  }

  return {
    href: parsed.href,
    hostname,
    protocol: parsed.protocol,
  };
}

/**
 * Resolve hostname and ensure every address is public.
 * @param {string} hostname
 * @param {{ lookupFn?: typeof dns.lookup }} [opts]
 */
export async function assertSafeResolvedHost(hostname, opts = {}) {
  const lookupFn = opts.lookupFn || dns.lookup;
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      const err = new Error('Resolved address is private or reserved');
      err.code = 'BRAND_URL_IP_DENIED';
      err.status = 400;
      throw err;
    }
    return [{ address: hostname, family: isIP(hostname) }];
  }

  let results;
  try {
    results = await lookupFn(hostname, { all: true, verbatim: true });
  } catch (e) {
    const err = new Error(`DNS resolution failed: ${e?.message || e}`);
    err.code = 'BRAND_URL_DNS_FAILED';
    err.status = 400;
    throw err;
  }

  const list = Array.isArray(results) ? results : results ? [results] : [];
  if (!list.length) {
    const err = new Error('DNS resolution returned no addresses');
    err.code = 'BRAND_URL_DNS_FAILED';
    err.status = 400;
    throw err;
  }

  for (const row of list) {
    const address = row.address || row;
    if (isPrivateOrReservedIp(String(address))) {
      const err = new Error(`Resolved address is not publicly routable: ${address}`);
      err.code = 'BRAND_URL_IP_DENIED';
      err.status = 400;
      throw err;
    }
  }

  return list;
}

/**
 * Full preflight for analysis URL (parse + DNS).
 * @param {string} raw
 * @param {{ lookupFn?: typeof dns.lookup }} [opts]
 */
export async function validateAnalysisUrl(raw, opts = {}) {
  const safe = assertSafeAnalysisUrl(raw);
  const addresses = await assertSafeResolvedHost(safe.hostname, opts);
  return { ...safe, addresses };
}

/**
 * Validate a redirect or subresource URL the same way.
 * @param {string} raw
 * @param {{ lookupFn?: typeof dns.lookup }} [opts]
 */
export async function validateNavigationTarget(raw, opts = {}) {
  return validateAnalysisUrl(raw, opts);
}
