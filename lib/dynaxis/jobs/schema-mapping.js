import { createJobEvent } from './events.js';
import { normalizeIdempotencyKey } from './idempotency.js';
import {
  assertKnownJobEvent,
  assertKnownJobState,
  assertNoCancellingState,
  assertTerminalStatesUnchanged,
  isTerminalPersistedState,
  normalizeFailureMessage,
  redactJobPersistenceMetadata,
} from './persistence.js';

function requireNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

export function mapJobRecordForPersistence(input) {
  assertTerminalStatesUnchanged();
  const {
    metadata,
    failureMetadata,
    providerCorrelation,
    failureMessage,
    ...rest
  } = input;
  const state = input.state;
  assertNoCancellingState(state);
  assertKnownJobState(state);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  return {
    ...rest,
    workspaceId: requireNonEmpty(input.workspaceId, 'workspaceId'),
    projectId: requireNonEmpty(input.projectId, 'projectId'),
    jobKind: requireNonEmpty(input.jobKind || 'generation', 'jobKind'),
    idempotencyKey,
    metadata: redactJobPersistenceMetadata(metadata),
    failureMetadata: redactJobPersistenceMetadata(failureMetadata),
    providerCorrelation: redactJobPersistenceMetadata(providerCorrelation),
    failureMessage: normalizeFailureMessage(failureMessage),
    terminalStateAt: isTerminalPersistedState(state) ? input.terminalStateAt || new Date() : null,
  };
}

export function mapJobEventForPersistence(input) {
  assertKnownJobEvent(input.kind);
  const builtEvent = createJobEvent({
    name: input.kind,
    jobId: input.jobId,
    payload: input.payload || {},
    correlation: input.correlation || {},
    idempotencyKey: input.idempotencyKey ?? null,
    occurredAt: input.providerOccurredAt || new Date().toISOString(),
  });

  return {
    ...input,
    workspaceId: requireNonEmpty(input.workspaceId, 'workspaceId'),
    projectId: requireNonEmpty(input.projectId, 'projectId'),
    actorType: requireNonEmpty(input.actorType, 'actorType'),
    source: requireNonEmpty(input.source, 'source'),
    payload: builtEvent.payload,
    correlation: builtEvent.correlation,
    idempotencyKey: builtEvent.idempotencyKey,
  };
}
