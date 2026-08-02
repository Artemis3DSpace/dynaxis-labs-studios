import { JOB_EVENT_NAMES, JOB_STATES, TERMINAL_JOB_STATES } from './contracts.js';
import { JobEngineError, JOB_ENGINE_ERROR_CODES } from './errors.js';

const JOB_STATE_SET = new Set(Object.values(JOB_STATES));
const JOB_EVENT_SET = new Set(Object.values(JOB_EVENT_NAMES));

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
