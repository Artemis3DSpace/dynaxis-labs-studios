export const BUILD_VERIFICATION_GATE_STATUSES = Object.freeze([
  'pass',
  'fail',
  'blocker',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

export function validateBuildVerificationGateContract(gateResult) {
  const issues = [];
  if (!gateResult || typeof gateResult !== 'object' || Array.isArray(gateResult)) {
    issues.push({ path: '$', message: 'verification gate result must be an object' });
    return { ok: false, issues };
  }

  if (!isNonEmptyString(gateResult.gateId)) {
    issues.push({ path: 'gateId', message: 'gateId is required' });
  }
  if (!isNonEmptyString(gateResult.gateName)) {
    issues.push({ path: 'gateName', message: 'gateName is required' });
  }
  if (!BUILD_VERIFICATION_GATE_STATUSES.includes(gateResult.status)) {
    issues.push({
      path: 'status',
      message: 'status must be pass, fail, or blocker',
    });
  }

  if (
    gateResult.status === 'fail' ||
    gateResult.status === 'blocker'
  ) {
    if (!isStringArray(gateResult.evidence) || gateResult.evidence.length === 0) {
      issues.push({
        path: 'evidence',
        message: 'failed or blocker gate must include evidence entries',
      });
    }
  } else if (
    gateResult.evidence !== undefined &&
    (!Array.isArray(gateResult.evidence) ||
      gateResult.evidence.some((item) => !isNonEmptyString(item)))
  ) {
    issues.push({
      path: 'evidence',
      message: 'evidence must be an array of non-empty strings when provided',
    });
  }

  return { ok: issues.length === 0, issues };
}
