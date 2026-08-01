export const REPOSITORY_BOOTSTRAP_MODES = Object.freeze([
  'placeholder_only',
]);

export const BRANCH_MANAGEMENT_MODES = Object.freeze([
  'placeholder_only',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateRepositoryBootstrapRequestPlaceholder(request) {
  const issues = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    issues.push({ path: '$', message: 'repository bootstrap request must be an object' });
    return { ok: false, issues };
  }

  if (!REPOSITORY_BOOTSTRAP_MODES.includes(request.mode)) {
    issues.push({
      path: 'mode',
      message: 'repository bootstrap is scaffold placeholder only',
    });
  }
  if (!request.targetRepository || typeof request.targetRepository !== 'object') {
    issues.push({
      path: 'targetRepository',
      message: 'targetRepository object is required',
    });
  } else {
    if (!isNonEmptyString(request.targetRepository.owner)) {
      issues.push({
        path: 'targetRepository.owner',
        message: 'targetRepository.owner is required',
      });
    }
    if (!isNonEmptyString(request.targetRepository.name)) {
      issues.push({
        path: 'targetRepository.name',
        message: 'targetRepository.name is required',
      });
    }
  }
  if (!isNonEmptyString(request.baseMainSha)) {
    issues.push({ path: 'baseMainSha', message: 'baseMainSha is required' });
  }

  return { ok: issues.length === 0, issues };
}

export function validateGitHubBranchManagementPlaceholder(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    issues.push({ path: '$', message: 'branch management contract must be an object' });
    return { ok: false, issues };
  }

  if (!BRANCH_MANAGEMENT_MODES.includes(contract.mode)) {
    issues.push({ path: 'mode', message: 'branch management is scaffold placeholder only' });
  }
  if (!isNonEmptyString(contract.requestedBranchName)) {
    issues.push({
      path: 'requestedBranchName',
      message: 'requestedBranchName is required',
    });
  }
  if (!isNonEmptyString(contract.baseRef)) {
    issues.push({ path: 'baseRef', message: 'baseRef is required' });
  }

  return { ok: issues.length === 0, issues };
}
