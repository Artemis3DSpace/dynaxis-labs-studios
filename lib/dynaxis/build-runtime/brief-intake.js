export const BRIEF_UNSAFE_PATTERNS = Object.freeze([
  /provider[-_\s]?connection/i,
  /\b(secret|token|api[-_\s]?key|password)\b/i,
  /\b(deploy|production deploy|release to production)\b/i,
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringList(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

export function validateBriefIntakeContract(briefIntake) {
  const issues = [];

  if (!briefIntake || typeof briefIntake !== 'object' || Array.isArray(briefIntake)) {
    issues.push({ path: '$', message: 'brief intake must be an object' });
    return { ok: false, issues };
  }

  if (!isNonEmptyString(briefIntake.projectId)) {
    issues.push({ path: 'projectId', message: 'projectId is required' });
  }
  if (!isNonEmptyString(briefIntake.title)) {
    issues.push({ path: 'title', message: 'title is required' });
  }
  if (!isNonEmptyString(briefIntake.userBrief)) {
    issues.push({ path: 'userBrief', message: 'userBrief is required' });
  }
  if (!isStringList(briefIntake.businessGoals) || briefIntake.businessGoals.length === 0) {
    issues.push({
      path: 'businessGoals',
      message: 'businessGoals must include at least one goal string',
    });
  }
  if (!isStringList(briefIntake.requiredOutputs) || briefIntake.requiredOutputs.length === 0) {
    issues.push({
      path: 'requiredOutputs',
      message: 'requiredOutputs must include at least one expected output string',
    });
  }
  if (
    briefIntake.constraints !== undefined &&
    (!Array.isArray(briefIntake.constraints) || !briefIntake.constraints.every((item) => isNonEmptyString(item)))
  ) {
    issues.push({
      path: 'constraints',
      message: 'constraints must be an array of non-empty strings when provided',
    });
  }

  if (isNonEmptyString(briefIntake.userBrief)) {
    const matchedPattern = BRIEF_UNSAFE_PATTERNS.find((pattern) => pattern.test(briefIntake.userBrief));
    if (matchedPattern) {
      issues.push({
        path: 'userBrief',
        message: `userBrief contains unsafe or out-of-scope content for scaffold intake (${matchedPattern})`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
