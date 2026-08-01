export const BUILD_RUNTIME_FORBIDDEN_PATH_PATTERNS = Object.freeze([
  /^lib\/dynaxis\/provider-connections\//i,
  /^lib\/dynaxis\/secrets\//i,
  /^app\/api\/dynaxis\/provider-connections\//i,
  /^packages\/studio\/src\/provider-connections\//i,
  /^drizzle\//i,
  /^schema\/migrations\//i,
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function normalizePath(pathValue) {
  return String(pathValue).trim().replaceAll('\\', '/');
}

function isForbiddenPath(pathValue) {
  const normalized = normalizePath(pathValue);
  return BUILD_RUNTIME_FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validateGeneratedWorkPackageContract(workPackage) {
  const issues = [];

  if (!workPackage || typeof workPackage !== 'object' || Array.isArray(workPackage)) {
    issues.push({ path: '$', message: 'work package must be an object' });
    return { ok: false, issues };
  }

  if (!isNonEmptyString(workPackage.phase)) {
    issues.push({ path: 'phase', message: 'phase is required' });
  }
  if (!isNonEmptyString(workPackage.title)) {
    issues.push({ path: 'title', message: 'title is required' });
  }
  if (!workPackage.scope || typeof workPackage.scope !== 'object' || Array.isArray(workPackage.scope)) {
    issues.push({ path: 'scope', message: 'scope object is required' });
  } else {
    if (!isNonEmptyString(workPackage.scope.summary)) {
      issues.push({ path: 'scope.summary', message: 'scope.summary is required' });
    }
    if (!isStringArray(workPackage.scope.deliverables) || workPackage.scope.deliverables.length === 0) {
      issues.push({
        path: 'scope.deliverables',
        message: 'scope.deliverables must include at least one item',
      });
    }
  }

  if (!isStringArray(workPackage.allowedPaths) || workPackage.allowedPaths.length === 0) {
    issues.push({
      path: 'allowedPaths',
      message: 'allowedPaths must include at least one path',
    });
  } else {
    workPackage.allowedPaths.forEach((pathValue, index) => {
      if (isForbiddenPath(pathValue)) {
        issues.push({
          path: `allowedPaths[${index}]`,
          message: `forbidden path is not allowed in generated work package (${pathValue})`,
        });
      }
    });
  }

  if (
    workPackage.forbiddenPaths !== undefined &&
    (!Array.isArray(workPackage.forbiddenPaths) ||
      workPackage.forbiddenPaths.some((pathValue) => !isNonEmptyString(pathValue)))
  ) {
    issues.push({
      path: 'forbiddenPaths',
      message: 'forbiddenPaths must be an array of non-empty strings when provided',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
