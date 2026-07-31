/**
 * Authenticated secret envelope service (WP-7D-04).
 *
 * Implements the WP-7D-02 envelope contract on top of the WP-7D-03 storage
 * shape. AEAD (AES-256-GCM by default) binds every ciphertext to its owner,
 * provider, credential kind, and secret version through Additional
 * Authenticated Data, so an envelope cannot be replayed across owners,
 * providers, credential kinds, or rotations.
 *
 * Boundaries:
 *   - plaintext never leaves this module except as a return value to the
 *     caller that supplied authorization (the materialization boundary);
 *   - plaintext is never logged, persisted, or serialized here;
 *   - provider adapters must never import this module.
 */

import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DYNAXIS_SECRET_ENVELOPE_ALGORITHMS } from './schema.js';
import { DYNAXIS_SECRET_ERROR_CODES, secretError } from './errors.js';
import { dynaxisKeyManager } from './keys.js';

export const DYNAXIS_DEFAULT_SECRET_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce
const AUTH_TAG_BYTES = 16;

function normalize(value) {
  return String(value ?? '').trim();
}

function requireContextField(value, label) {
  const normalized = normalize(value);
  if (!normalized) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_INVALID,
      500,
      `Secret envelope context is missing ${label}`
    );
  }
  return normalized;
}

/**
 * Normalizes the AAD context. `ownerId` is the ownerUserId or
 * ownerWorkspaceId selected by ownerType — never provider account metadata.
 */
export function normalizeSecretContext(context = {}) {
  const ownerType = requireContextField(context.ownerType, 'ownerType');
  if (ownerType !== 'user' && ownerType !== 'workspace') {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_INVALID,
      500,
      'Secret envelope ownerType must be user or workspace'
    );
  }
  const secretVersion = Number(context.secretVersion);
  if (!Number.isInteger(secretVersion) || secretVersion < 1) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_INVALID,
      500,
      'Secret envelope secretVersion must be an integer >= 1'
    );
  }
  return {
    ownerType,
    ownerId: requireContextField(context.ownerId, 'ownerId'),
    providerId: requireContextField(context.providerId, 'providerId'),
    credentialKind: requireContextField(context.credentialKind, 'credentialKind'),
    secretVersion,
  };
}

/**
 * WP-7D-02 AAD binding:
 *   ownerType:ownerId:providerId:credentialKind:secretVersion
 */
export function buildSecretAad(context) {
  const normalized = normalizeSecretContext(context);
  return [
    normalized.ownerType,
    normalized.ownerId,
    normalized.providerId,
    normalized.credentialKind,
    String(normalized.secretVersion),
  ].join(':');
}

/**
 * Non-reversible, non-authenticating digest for operator recognition only.
 * Truncated so it cannot be used to reconstruct or verify the credential.
 */
export function credentialFingerprint(plaintext) {
  const value = normalize(plaintext);
  if (!value) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.PLAINTEXT_REQUIRED,
      400,
      'Credential material is required to compute a fingerprint'
    );
  }
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12)}`;
}

function assertAlgorithm(algorithm) {
  const normalized = normalize(algorithm) || DYNAXIS_DEFAULT_SECRET_ALGORITHM;
  if (!DYNAXIS_SECRET_ENVELOPE_ALGORITHMS.includes(normalized)) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.UNSUPPORTED_ALGORITHM,
      500,
      `Unsupported secret algorithm: ${normalized}`
    );
  }
  return normalized;
}

function cipherOptions(algorithm) {
  return algorithm === 'chacha20-poly1305' ? { authTagLength: AUTH_TAG_BYTES } : undefined;
}

/**
 * Encrypts credential material into an envelope row shape.
 * Returns only ciphertext components and persisted AAD context — never the
 * plaintext, and never the key.
 */
export async function sealSecret({
  plaintext,
  context,
  keyRef = null,
  algorithm = DYNAXIS_DEFAULT_SECRET_ALGORITHM,
  keyManager = dynaxisKeyManager,
} = {}) {
  const value = normalize(plaintext);
  if (!value) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.PLAINTEXT_REQUIRED,
      400,
      'Credential material is required'
    );
  }
  const normalizedContext = normalizeSecretContext(context);
  const usedAlgorithm = assertAlgorithm(algorithm);
  const resolvedKeyRef = normalize(keyRef) || keyManager.defaultKeyRef();
  if (!resolvedKeyRef) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE,
      503,
      'No secret key is configured for this environment'
    );
  }

  const key = await keyManager.resolveKey(resolvedKeyRef);
  const iv = randomBytes(IV_BYTES);
  const aad = buildSecretAad(normalizedContext);

  const cipher = createCipheriv(usedAlgorithm, key, iv, cipherOptions(usedAlgorithm));
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: usedAlgorithm,
    keyRef: resolvedKeyRef,
    encryptedPayload: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
    iv: iv.toString('base64'),
    secretVersion: normalizedContext.secretVersion,
    aadOwnerType: normalizedContext.ownerType,
    aadOwnerId: normalizedContext.ownerId,
    aadProviderId: normalizedContext.providerId,
    aadCredentialKind: normalizedContext.credentialKind,
    aadSecretVersion: normalizedContext.secretVersion,
  };
}

function envelopeContext(envelope) {
  return {
    ownerType: envelope?.aadOwnerType,
    ownerId: envelope?.aadOwnerId,
    providerId: envelope?.aadProviderId,
    credentialKind: envelope?.aadCredentialKind,
    secretVersion: envelope?.aadSecretVersion,
  };
}

function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Decrypts an envelope and returns plaintext to the immediate caller.
 *
 * `expectedContext` is rebuilt by the caller from the *persisted connection*
 * row, never from request input. The envelope's own persisted AAD columns are
 * compared against it first (cheap, explicit), and the AEAD tag then verifies
 * the binding cryptographically. Either check failing is fail-closed.
 */
export async function openSecret({
  envelope,
  expectedContext,
  keyManager = dynaxisKeyManager,
} = {}) {
  if (!envelope) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_INVALID,
      500,
      'Secret envelope is required'
    );
  }

  const persistedAad = buildSecretAad(envelopeContext(envelope));
  const expectedAad = buildSecretAad(expectedContext);
  if (!constantTimeEquals(persistedAad, expectedAad)) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.AAD_MISMATCH,
      403,
      'Secret envelope context does not match the ProviderConnection context'
    );
  }

  const usedAlgorithm = assertAlgorithm(envelope.algorithm);
  const keyRef = normalize(envelope.keyRef);
  if (!keyRef) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.KEY_UNAVAILABLE,
      503,
      'Secret envelope is missing a keyRef'
    );
  }

  const key = await keyManager.resolveKey(keyRef);
  const iv = Buffer.from(normalize(envelope.iv), 'base64');
  const authTag = Buffer.from(normalize(envelope.authTag), 'base64');
  const ciphertext = Buffer.from(normalize(envelope.encryptedPayload), 'base64');
  if (!iv.length || !authTag.length || !ciphertext.length) {
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT,
      500,
      'Secret envelope ciphertext components are incomplete'
    );
  }

  try {
    const decipher = createDecipheriv(usedAlgorithm, key, iv, cipherOptions(usedAlgorithm));
    decipher.setAAD(Buffer.from(expectedAad, 'utf8'));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Never surface the underlying cipher error: it can leak structure.
    throw secretError(
      DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_CORRUPT,
      500,
      'Secret envelope failed authenticated decryption'
    );
  }
}
