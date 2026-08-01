import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  JOB_FAILURE_KINDS,
  JOB_STATES,
  JOB_TRANSITIONS,
  canCancelJob,
  canTimeoutJob,
  classifyFailureForRetry,
  isTerminalJobState,
  transitionJobState,
  assertWorkerProviderConnectionBlocked,
  JOB_ENGINE_ERROR_CODES,
} from '../lib/dynaxis/jobs/index.js';

test('job state machine allows canonical transitions', () => {
  for (const [fromState, targets] of Object.entries(JOB_TRANSITIONS)) {
    for (const toState of targets) {
      assert.equal(transitionJobState(fromState, toState), toState);
    }
  }
});

test('job state machine rejects invalid transitions', () => {
  assert.throws(
    () => transitionJobState(JOB_STATES.QUEUED, JOB_STATES.COMPLETED),
    /Invalid job transition/
  );
  assert.throws(
    () => transitionJobState(JOB_STATES.RUNNING, JOB_STATES.QUEUED),
    /Invalid job transition/
  );
});

test('terminal states cannot move and cancellation only applies to non-terminal states', () => {
  for (const terminalState of [JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.CANCELLED]) {
    assert.equal(isTerminalJobState(terminalState), true);
    assert.equal(canCancelJob(terminalState), false);
    assert.throws(
      () => transitionJobState(terminalState, JOB_STATES.QUEUED),
      /Invalid job transition/
    );
  }
  assert.equal(canCancelJob(JOB_STATES.RUNNING), true);
});

test('retry and timeout concepts are classified deterministically', () => {
  assert.equal(
    classifyFailureForRetry({ kind: JOB_FAILURE_KINDS.TRANSIENT, retryBudgetRemaining: 1 }),
    JOB_STATES.WAITING_RETRY
  );
  assert.equal(
    classifyFailureForRetry({ kind: JOB_FAILURE_KINDS.TRANSIENT, retryBudgetRemaining: 0 }),
    JOB_STATES.FAILED
  );
  assert.equal(
    classifyFailureForRetry({ kind: JOB_FAILURE_KINDS.TIMEOUT, retryBudgetRemaining: 2 }),
    JOB_STATES.WAITING_RETRY
  );
  assert.equal(
    classifyFailureForRetry({ kind: JOB_FAILURE_KINDS.TIMEOUT, retryBudgetRemaining: 0 }),
    JOB_STATES.TIMED_OUT
  );
  assert.equal(canTimeoutJob(JOB_STATES.LEASED), true);
  assert.equal(canTimeoutJob(JOB_STATES.RUNNING), true);
  assert.equal(canTimeoutJob(JOB_STATES.QUEUED), false);
});

test('worker ProviderConnection dispatch remains explicitly blocked', () => {
  assert.throws(
    () => assertWorkerProviderConnectionBlocked(),
    (error) => error?.code === JOB_ENGINE_ERROR_CODES.WORKER_PROVIDER_CONNECTION_BLOCKED
  );
});

test('jobs scaffold has no provider-connections module dependency', async () => {
  const source = await readFile(
    new URL('../lib/dynaxis/jobs/index.js', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /provider-connections/);
});

