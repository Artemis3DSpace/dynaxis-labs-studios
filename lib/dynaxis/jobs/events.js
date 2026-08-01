import {
  CORRELATION_ID_FIELDS,
  JOB_EVENT_NAMES,
  REDACTED_EVENT_PAYLOAD_KEYS,
} from './contracts.js';
import { JobEngineError, JOB_ENGINE_ERROR_CODES } from './errors.js';
import { normalizeIdempotencyKey } from './idempotency.js';

const REDACTION_SENTINEL = '[REDACTED]';

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (REDACTED_EVENT_PAYLOAD_KEYS.includes(key)) {
      out[key] = REDACTION_SENTINEL;
      continue;
    }
    out[key] = redactValue(child);
  }
  return out;
}

export function redactEventPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new JobEngineError('Event payload must be an object.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
    });
  }
  return redactValue(payload);
}

export function validateCorrelationIds(correlation = {}) {
  if (!correlation || typeof correlation !== 'object' || Array.isArray(correlation)) {
    throw new JobEngineError('Correlation ids must be an object.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
    });
  }
  const out = {};
  for (const field of CORRELATION_ID_FIELDS) {
    const value = correlation[field];
    if (value == null) {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      throw new JobEngineError(`Correlation id field "${field}" must be a non-empty string.`, {
        code: JOB_ENGINE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
        details: { field },
      });
    }
    out[field] = value.trim();
  }
  return out;
}

export function createJobEvent({
  name,
  jobId,
  payload = {},
  correlation = {},
  idempotencyKey,
  occurredAt = new Date().toISOString(),
}) {
  if (!Object.values(JOB_EVENT_NAMES).includes(name)) {
    throw new JobEngineError(`Unknown job event name: ${name}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_EVENT,
    });
  }
  if (typeof jobId !== 'string' || !jobId.trim()) {
    throw new JobEngineError('jobId is required for job events.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_EVENT,
    });
  }
  const safePayload = redactEventPayload(payload);
  const safeCorrelation = validateCorrelationIds(correlation);
  return {
    name,
    jobId: jobId.trim(),
    occurredAt,
    payload: safePayload,
    correlation: safeCorrelation,
    idempotencyKey: idempotencyKey == null ? null : normalizeIdempotencyKey(idempotencyKey),
  };
}

