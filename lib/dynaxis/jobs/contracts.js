import { JobEngineError, JOB_ENGINE_ERROR_CODES } from './errors.js';

export const JOB_STATES = Object.freeze({
  QUEUED: 'queued',
  LEASED: 'leased',
  RUNNING: 'running',
  WAITING_RETRY: 'waiting_retry',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMED_OUT: 'timed_out',
});

export const TERMINAL_JOB_STATES = Object.freeze([
  JOB_STATES.COMPLETED,
  JOB_STATES.FAILED,
  JOB_STATES.CANCELLED,
]);

export const JOB_TRANSITIONS = Object.freeze({
  [JOB_STATES.QUEUED]: [JOB_STATES.LEASED, JOB_STATES.CANCELLED],
  [JOB_STATES.LEASED]: [JOB_STATES.RUNNING, JOB_STATES.WAITING_RETRY, JOB_STATES.FAILED, JOB_STATES.CANCELLED, JOB_STATES.TIMED_OUT],
  [JOB_STATES.RUNNING]: [JOB_STATES.COMPLETED, JOB_STATES.WAITING_RETRY, JOB_STATES.FAILED, JOB_STATES.CANCELLED, JOB_STATES.TIMED_OUT],
  [JOB_STATES.WAITING_RETRY]: [JOB_STATES.QUEUED, JOB_STATES.FAILED, JOB_STATES.CANCELLED],
  [JOB_STATES.TIMED_OUT]: [JOB_STATES.WAITING_RETRY, JOB_STATES.FAILED, JOB_STATES.CANCELLED],
  [JOB_STATES.COMPLETED]: [],
  [JOB_STATES.FAILED]: [],
  [JOB_STATES.CANCELLED]: [],
});

export const JOB_EVENT_NAMES = Object.freeze({
  CREATED: 'job.created',
  DISPATCHED: 'job.dispatched',
  PROVIDER_UPDATED: 'job.provider_updated',
  RETRIED: 'job.retried',
  COMPLETED: 'job.completed',
  FAILED: 'job.failed',
  CANCELLED: 'job.cancelled',
  RECONCILED: 'job.reconciled',
});

export const REDACTED_EVENT_PAYLOAD_KEYS = Object.freeze([
  'apiKey',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
  'secretRef',
  'keyRef',
  'encryptedPayload',
  'authTag',
  'iv',
  'aad',
  'rawCredential',
  'providerCredential',
]);

export const CORRELATION_ID_FIELDS = Object.freeze([
  'requestId',
  'generationId',
  'assetId',
  'jobId',
  'providerJobId',
  'workspaceId',
]);

export const WORKER_PROVIDER_CONNECTION_POLICY = Object.freeze({
  status: 'blocked',
  reason:
    'WP-7E scaffold blocks ProviderConnection use from worker dispatch until an explicit, tested service-principal allowlist exists.',
  futureOwner: 'WP-7E-06',
});

export function assertWorkerProviderConnectionBlocked() {
  throw new JobEngineError(
    'ProviderConnection use from worker dispatch is blocked until service-principal allowlist exists.',
    {
      code: JOB_ENGINE_ERROR_CODES.WORKER_PROVIDER_CONNECTION_BLOCKED,
      status: 501,
      details: WORKER_PROVIDER_CONNECTION_POLICY,
    }
  );
}

