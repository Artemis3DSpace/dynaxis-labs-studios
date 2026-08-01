/**
 * Phase 7I verification and execution result contract scaffold.
 */

export const VERIFICATION_RESULT_STATUSES = /** @type {const} */ (['pass', 'fail', 'blocker']);
export const EXECUTION_RESULT_STATUSES = /** @type {const} */ ([
  'queued',
  'running',
  'completed',
  'failed',
  'blocked',
]);

/**
 * @param {unknown} input
 */
export function validateVerificationResultContract(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Verification result must be an object');
  }
  const status = String(input.status || '')
    .trim()
    .toLowerCase();
  if (!VERIFICATION_RESULT_STATUSES.includes(status)) {
    throw new Error(`Unknown verification status: ${input.status ?? ''}`);
  }
  return {
    status,
    summary: String(input.summary || '').trim() || null,
    checks: Array.isArray(input.checks) ? [...input.checks] : [],
  };
}

/**
 * @param {unknown} input
 */
export function validateExecutionResultContract(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Execution result must be an object');
  }

  const status = String(input.status || '')
    .trim()
    .toLowerCase();
  if (!EXECUTION_RESULT_STATUSES.includes(status)) {
    throw new Error(`Unknown execution status: ${input.status ?? ''}`);
  }

  return {
    status,
    outputRef: String(input.outputRef || '').trim() || null,
    errorCode: String(input.errorCode || '').trim() || null,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
  };
}
