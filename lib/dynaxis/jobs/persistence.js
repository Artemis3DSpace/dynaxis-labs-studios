import { JOB_EVENT_NAMES, JOB_STATES, TERMINAL_JOB_STATES } from './contracts.js';
import { JobEngineError, JOB_ENGINE_ERROR_CODES } from './errors.js';

const JOB_STATE_SET = new Set(Object.values(JOB_STATES));
const JOB_EVENT_SET = new Set(Object.values(JOB_EVENT_NAMES));
const REDACTION_SENTINEL = '[REDACTED]';
const FAILURE_MESSAGE_MAX_LENGTH = 1024;
const REDACTED_JOB_PAYLOAD_KEYS = new Set([
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'authorizationCode',
  'authorization_code',
  'secret',
  'secretRef',
  'secret_ref',
  'secretVersion',
  'secret_version',
  'keyRef',
  'key_ref',
  'encryptedPayload',
  'encrypted_payload',
  'authTag',
  'auth_tag',
  'iv',
  'aad',
  'rawCredential',
  'raw_credential',
  'providerCredential',
  'provider_credential',
  'clientSecret',
  'client_secret',
  'serviceAccountJson',
  'service_account_json',
  'webhookSecret',
  'webhook_secret',
  'oauth',
]);

function redactDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (REDACTED_JOB_PAYLOAD_KEYS.has(key)) {
      output[key] = REDACTION_SENTINEL;
      continue;
    }
    output[key] = redactDeep(child);
  }
  return output;
}

export function redactJobPersistenceMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return redactDeep(value);
}

export function normalizeFailureMessage(value) {
  if (value == null) {
    return null;
  }
  const text = String(value);
  if (!text) {
    return null;
  }
  return text.length <= FAILURE_MESSAGE_MAX_LENGTH
    ? text
    : text.slice(0, FAILURE_MESSAGE_MAX_LENGTH);
}

export function assertKnownJobState(state, field = 'state') {
  if (!JOB_STATE_SET.has(state)) {
    throw new JobEngineError(`Unknown job state: ${state}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { field, state },
    });
  }
}

export function assertKnownJobEvent(kind, field = 'kind') {
  if (!JOB_EVENT_SET.has(kind)) {
    throw new JobEngineError(`Unknown job event: ${kind}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_EVENT,
      details: { field, kind },
    });
  }
}

export function assertNoCancellingState(state) {
  if (state === 'cancelling') {
    throw new JobEngineError('State "cancelling" is not part of the canonical 7E vocabulary.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { state },
    });
  }
}

export function isTerminalPersistedState(state) {
  assertKnownJobState(state);
  return TERMINAL_JOB_STATES.includes(state);
}

export function assertTerminalStatesUnchanged() {
  const canonical = ['completed', 'failed', 'cancelled'];
  if (
    TERMINAL_JOB_STATES.length !== canonical.length ||
    TERMINAL_JOB_STATES.some((value, index) => value !== canonical[index])
  ) {
    throw new JobEngineError('Terminal state vocabulary diverged from canonical scaffold.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { terminalStates: TERMINAL_JOB_STATES },
    });
  }
}
