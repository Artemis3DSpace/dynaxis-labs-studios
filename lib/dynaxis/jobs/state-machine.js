import { JOB_STATES, JOB_TRANSITIONS, TERMINAL_JOB_STATES } from './contracts.js';
import { JobEngineError, JOB_ENGINE_ERROR_CODES, JobTransitionError } from './errors.js';

export const JOB_FAILURE_KINDS = Object.freeze({
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
});

export function isKnownJobState(state) {
  return Object.values(JOB_STATES).includes(state);
}

export function isTerminalJobState(state) {
  return TERMINAL_JOB_STATES.includes(state);
}

export function getAllowedTransitions(fromState) {
  if (!isKnownJobState(fromState)) {
    throw new JobEngineError(`Unknown job state: ${fromState}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { fromState },
    });
  }
  return [...JOB_TRANSITIONS[fromState]];
}

export function canTransitionJobState(fromState, toState) {
  if (!isKnownJobState(fromState) || !isKnownJobState(toState)) {
    return false;
  }
  return JOB_TRANSITIONS[fromState].includes(toState);
}

export function transitionJobState(fromState, toState, context = {}) {
  if (!isKnownJobState(fromState)) {
    throw new JobEngineError(`Unknown job state: ${fromState}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { fromState, toState, context },
    });
  }
  if (!isKnownJobState(toState)) {
    throw new JobEngineError(`Unknown target job state: ${toState}`, {
      code: JOB_ENGINE_ERROR_CODES.INVALID_JOB_STATE,
      details: { fromState, toState, context },
    });
  }
  if (!canTransitionJobState(fromState, toState)) {
    throw new JobTransitionError(`Invalid job transition from "${fromState}" to "${toState}"`, {
      fromState,
      toState,
      context,
      allowedTransitions: getAllowedTransitions(fromState),
    });
  }
  return toState;
}

export function classifyFailureForRetry({ kind, retryBudgetRemaining = 0 } = {}) {
  if (kind === JOB_FAILURE_KINDS.TRANSIENT) {
    return retryBudgetRemaining > 0 ? JOB_STATES.WAITING_RETRY : JOB_STATES.FAILED;
  }
  if (kind === JOB_FAILURE_KINDS.TIMEOUT) {
    return retryBudgetRemaining > 0 ? JOB_STATES.WAITING_RETRY : JOB_STATES.TIMED_OUT;
  }
  if (kind === JOB_FAILURE_KINDS.CANCELLED) {
    return JOB_STATES.CANCELLED;
  }
  return JOB_STATES.FAILED;
}

export function isRetryableFailure(kind) {
  return kind === JOB_FAILURE_KINDS.TRANSIENT || kind === JOB_FAILURE_KINDS.TIMEOUT;
}

export function canCancelJob(state) {
  if (!isKnownJobState(state)) {
    return false;
  }
  return !isTerminalJobState(state);
}

export function canTimeoutJob(state) {
  return state === JOB_STATES.LEASED || state === JOB_STATES.RUNNING;
}

