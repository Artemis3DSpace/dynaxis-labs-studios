export const PREVIEW_BOUNDARY_MODES = Object.freeze([
  'placeholder_only',
]);

export const DEPLOYMENT_BOUNDARY_MODES = Object.freeze([
  'placeholder_only',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

export function validateRepairLoopContract(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    issues.push({ path: '$', message: 'repair-loop contract must be an object' });
    return { ok: false, issues };
  }

  if (!isNonEmptyString(contract.triggerGateId)) {
    issues.push({
      path: 'triggerGateId',
      message: 'triggerGateId is required',
    });
  }
  if (!['fail', 'blocker'].includes(contract.triggerGateStatus)) {
    issues.push({
      path: 'triggerGateStatus',
      message: 'triggerGateStatus must be fail or blocker',
    });
  }
  if (!isStringArray(contract.failedGateEvidence) || contract.failedGateEvidence.length === 0) {
    issues.push({
      path: 'failedGateEvidence',
      message: 'failedGateEvidence is required to enter the repair loop',
    });
  }

  return { ok: issues.length === 0, issues };
}

export function validatePreviewEnvironmentPlaceholder(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    issues.push({ path: '$', message: 'preview environment contract must be an object' });
    return { ok: false, issues };
  }

  if (!PREVIEW_BOUNDARY_MODES.includes(contract.mode)) {
    issues.push({
      path: 'mode',
      message: 'preview environment is scaffold placeholder only',
    });
  }
  if (
    contract.previewActions !== undefined &&
    (!Array.isArray(contract.previewActions) ||
      contract.previewActions.some((item) => !isNonEmptyString(item)))
  ) {
    issues.push({
      path: 'previewActions',
      message: 'previewActions must be an array of non-empty strings when provided',
    });
  }

  return { ok: issues.length === 0, issues };
}

export function validateDeploymentBoundaryPlaceholder(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    issues.push({ path: '$', message: 'deployment boundary contract must be an object' });
    return { ok: false, issues };
  }

  if (!DEPLOYMENT_BOUNDARY_MODES.includes(contract.mode)) {
    issues.push({
      path: 'mode',
      message: 'deployment boundary is scaffold placeholder only',
    });
  }
  if (contract.productionDeploymentEnabled !== false) {
    issues.push({
      path: 'productionDeploymentEnabled',
      message: 'productionDeploymentEnabled must be false in scaffold contracts',
    });
  }

  return { ok: issues.length === 0, issues };
}
