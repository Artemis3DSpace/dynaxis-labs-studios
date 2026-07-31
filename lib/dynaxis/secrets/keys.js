/**
 * Key-management boundary for Dynaxis secret envelopes (WP-7D-04).
 *
 * This module resolves a `keyRef` to raw key material for the envelope
 * service. It never returns key material to callers outside
 * `lib/dynaxis/secrets/`, never logs key material, and never persists it.
 *
 * Three providers per WP-7D-02:
 *
 *   kms://<region>/<alias>/<version>  production KMS / HSM. Interface only —
 *                                     fails closed until a deployment wires a
 *                                     real adapter. No cloud SDK is bundled.
 *   local://<key-id>                  local development. Key material comes
 *                                     from the environment (never committed,
 *                                     never read from the repo). Fails closed
 *                                     when absent.
 *   test://<algorithm>/<key-id>       deterministic test keys. Refuses to
 *                                     activate outside NODE_ENV=test, so it
 *                                     cannot be reached in production by
 *                                     accident.
 *
 * Provider adapters must never call into this module; only the envelope
 * service may resolve keys.
 */

import 'server-only';
import { createHash } from 'node:crypto';
import { DYNAXIS_SECRET_ERROR_CODES, secretError } from './errors.js';

export const DYNAXIS_SECRET_KEY_BYTES = 32; // 256-bit minimum

export const DYNAXIS_KEY_PROVIDERS = Object.freeze({
  KMS: 'kms',
  LOCAL: 'local',
  TEST: 'test',
});

/** Env var holding a base64 256-bit key for local development. */
export const DYNAXIS_LOCAL_KEY_ENV_PREFIX = 'DYNAXIS_SECRET_LOCAL_KEY';

/** Fixed seed for deterministic test keys. Test-only; never a production key. */
const TEST_KEY_SEED = 'dynaxis-deterministic-test-key-seed-do-not-use-in-production';

function normalize(value) {
  return String(value || '').trim();
}

/**
 * Parses a keyRef into its provider and parts without touching key material.
 */
export function parseKeyRef(keyRef) {
  const normalized = normalize(keyRef);
  const match = normalized.match(/^([a-z0-9-]+):\/\/(.+)$/);
  if (!match) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.KEY_REF_INVALID,
      500,
      'keyRef must look like <provider>://<path>'
    );
  }
  const [, provider, rest] = match;
  const parts = rest.split('/').filter(Boolean);
  if (!parts.length) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.KEY_REF_INVALID,
      500,
      'keyRef is missing a key identifier'
    );
  }
  return { provider, parts, keyRef: normalized };
}

function isProductionEnv(env) {
  return env.NODE_ENV === 'production';
}

function isTestEnv(env) {
  return env.NODE_ENV === 'test';
}

/**
 * Production KMS boundary. Intentionally unimplemented: a deployment must
 * supply a real adapter. Until then every resolution fails closed rather than
 * degrading to a weaker local key.
 */
export function createKmsKeyProvider({ adapter = null } = {}) {
  return {
    provider: DYNAXIS_KEY_PROVIDERS.KMS,
    isConfigured() {
      return typeof adapter?.resolveKey === 'function';
    },
    async resolveKey(parsed) {
      if (typeof adapter?.resolveKey !== 'function') {
        throw secretError(
          DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_UNCONFIGURED,
          503,
          'No KMS adapter is configured for this deployment'
        );
      }
      const key = await adapter.resolveKey(parsed.keyRef);
      return assertKeyMaterial(key);
    },
  };
}

/**
 * Local development keys. Material is read only from the environment so it is
 * never committed and never sourced from a repo path.
 */
export function createLocalKeyProvider({ env = process.env } = {}) {
  return {
    provider: DYNAXIS_KEY_PROVIDERS.LOCAL,
    isConfigured() {
      return Boolean(normalize(env[DYNAXIS_LOCAL_KEY_ENV_PREFIX]));
    },
    async resolveKey(parsed) {
      if (isProductionEnv(env)) {
        throw secretError(
          DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_FORBIDDEN_ENVIRONMENT,
          500,
          'Local development keys are not permitted in production'
        );
      }
      const keyId = parsed.parts.join('_').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
      const scoped = normalize(env[`${DYNAXIS_LOCAL_KEY_ENV_PREFIX}_${keyId}`]);
      const fallback = normalize(env[DYNAXIS_LOCAL_KEY_ENV_PREFIX]);
      const encoded = scoped || fallback;
      if (!encoded) {
        throw secretError(
          DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE,
          503,
          `Local secret key is not available. Set ${DYNAXIS_LOCAL_KEY_ENV_PREFIX} to a base64 256-bit key.`
        );
      }
      return assertKeyMaterial(Buffer.from(encoded, 'base64'));
    },
  };
}

/**
 * Deterministic test keys. Hard-gated to NODE_ENV=test so a misconfigured
 * production deployment cannot silently fall back to a known key.
 */
export function createTestKeyProvider({ env = process.env } = {}) {
  return {
    provider: DYNAXIS_KEY_PROVIDERS.TEST,
    isConfigured() {
      return isTestEnv(env);
    },
    async resolveKey(parsed) {
      if (!isTestEnv(env)) {
        throw secretError(
          DYNAXIS_SECRET_ERROR_CODES.KEY_PROVIDER_FORBIDDEN_ENVIRONMENT,
          500,
          'Deterministic test keys are only available when NODE_ENV=test'
        );
      }
      const material = createHash('sha256')
        .update(`${TEST_KEY_SEED}:${parsed.parts.join('/')}`, 'utf8')
        .digest();
      return assertKeyMaterial(material);
    },
  };
}

function assertKeyMaterial(key) {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key || [], 'base64');
  if (buffer.length < DYNAXIS_SECRET_KEY_BYTES) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE,
      500,
      `Secret key must be at least ${DYNAXIS_SECRET_KEY_BYTES} bytes`
    );
  }
  return buffer.subarray(0, DYNAXIS_SECRET_KEY_BYTES);
}

/**
 * Creates the key-management facade used by the envelope service.
 */
export function createDynaxisKeyManager({ env = process.env, kmsAdapter = null } = {}) {
  const providers = new Map([
    [DYNAXIS_KEY_PROVIDERS.KMS, createKmsKeyProvider({ adapter: kmsAdapter })],
    [DYNAXIS_KEY_PROVIDERS.LOCAL, createLocalKeyProvider({ env })],
    [DYNAXIS_KEY_PROVIDERS.TEST, createTestKeyProvider({ env })],
  ]);

  return {
    /**
     * Resolves key material for a keyRef. Throws fail-closed on unknown
     * provider, unconfigured provider, wrong environment, or short key.
     */
    async resolveKey(keyRef) {
      const parsed = parseKeyRef(keyRef);
      const provider = providers.get(parsed.provider);
      if (!provider) {
        throw secretError(
          DYNAXIS_SECRET_ERROR_CODES.KEY_REF_INVALID,
          500,
          `Unsupported key provider in keyRef: ${parsed.provider}`
        );
      }
      return provider.resolveKey(parsed);
    },
    isConfigured(keyRef) {
      try {
        const parsed = parseKeyRef(keyRef);
        return Boolean(providers.get(parsed.provider)?.isConfigured());
      } catch {
        return false;
      }
    },
    /** Default keyRef for this environment, or null when none is safe. */
    defaultKeyRef() {
      if (isTestEnv(env)) {
        return 'test://aes-256-gcm/default';
      }
      if (!isProductionEnv(env) && normalize(env[DYNAXIS_LOCAL_KEY_ENV_PREFIX])) {
        return 'local://default';
      }
      return null;
    },
  };
}

export const dynaxisKeyManager = createDynaxisKeyManager();
