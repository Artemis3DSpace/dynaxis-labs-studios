import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkPackageRuntimeContract,
  validateVerificationResultContract,
  validateExecutionResultContract,
  normalizeAgentActionCategory,
} from '../lib/dynaxis/agents/index.js';

test('agent work-package contract requires id, phase, title, and type', () => {
  assert.throws(() => validateWorkPackageRuntimeContract({}), /requires id/);
  assert.throws(() => validateWorkPackageRuntimeContract({ id: 'WP-7I-02' }), /requires phase/);
  assert.throws(
    () => validateWorkPackageRuntimeContract({ id: 'WP-7I-02', phase: '7I' }),
    /requires title/
  );
  assert.throws(
    () => validateWorkPackageRuntimeContract({ id: 'WP-7I-02', phase: '7I', title: 'Runtime' }),
    /Unknown work package type/
  );

  const parsed = validateWorkPackageRuntimeContract({
    id: 'WP-7I-02',
    phase: '7I',
    title: 'Engineering WorkPackage Runtime Contract',
    type: 'implementation',
    assignedRole: 'implementer',
  });
  assert.equal(parsed.type, 'implementation');
  assert.equal(parsed.assignedRole, 'implementer');
});

test('verification result contract supports pass, fail, and blocker', () => {
  assert.equal(validateVerificationResultContract({ status: 'pass' }).status, 'pass');
  assert.equal(validateVerificationResultContract({ status: 'fail' }).status, 'fail');
  assert.equal(validateVerificationResultContract({ status: 'blocker' }).status, 'blocker');
  assert.throws(() => validateVerificationResultContract({ status: 'unknown' }), /Unknown verification status/);
});

test('execution result contract supports status and payload placeholders', () => {
  const parsed = validateExecutionResultContract({
    status: 'completed',
    outputRef: 'artifact://result.json',
    metadata: { durationMs: 1200 },
  });
  assert.equal(parsed.status, 'completed');
  assert.equal(parsed.outputRef, 'artifact://result.json');
});

test('agent action categories normalize consistently', () => {
  assert.equal(normalizeAgentActionCategory(' Verify '), 'verify');
  assert.equal(normalizeAgentActionCategory('deploy'), null);
});
