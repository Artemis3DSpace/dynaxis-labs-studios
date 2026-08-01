export const JOB_ENGINE_ERROR_CODES = Object.freeze({
  INVALID_JOB_STATE: 'INVALID_JOB_STATE',
  INVALID_JOB_TRANSITION: 'INVALID_JOB_TRANSITION',
  INVALID_JOB_EVENT: 'INVALID_JOB_EVENT',
  INVALID_EVENT_PAYLOAD: 'INVALID_EVENT_PAYLOAD',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  WORKER_PROVIDER_CONNECTION_BLOCKED: 'WORKER_PROVIDER_CONNECTION_BLOCKED',
});

export class JobEngineError extends Error {
  constructor(message, { code, status = 400, details } = {}) {
    super(message);
    this.name = 'JobEngineError';
    this.code = code || JOB_ENGINE_ERROR_CODES.INVALID_JOB_EVENT;
    this.status = status;
    this.details = details || null;
  }
}

export class JobTransitionError extends JobEngineError {
  constructor(message, details) {
    super(message, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_TRANSITION,
      status: 409,
      details,
    });
    this.name = 'JobTransitionError';
  }
}

