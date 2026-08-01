export const LAYOUT_MODES = Object.freeze(['stack', 'row', 'grid']);
export const CONSTRAINT_RULE_TYPES = Object.freeze([
  'pin',
  'align',
  'size',
  'spacing',
  'visibility',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

export function validateSpacingTokens(tokens, { path = 'spacingTokens' } = {}) {
  const issues = [];
  if (!isPlainObject(tokens)) {
    pushIssue(issues, path, 'spacing tokens must be an object map');
    return { ok: false, issues };
  }

  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    if (!/^[a-z0-9-]+$/.test(tokenName)) {
      pushIssue(issues, `${path}.${tokenName}`, 'token name must be kebab-case');
    }
    if (!Number.isFinite(tokenValue) || tokenValue < 0) {
      pushIssue(issues, `${path}.${tokenName}`, 'token value must be a finite number >= 0');
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateConstraintRule(rule, { path = 'constraintRule' } = {}) {
  const issues = [];
  if (!isPlainObject(rule)) {
    pushIssue(issues, path, 'constraint rule must be an object');
    return { ok: false, issues };
  }

  if (typeof rule.targetComponentId !== 'string' || rule.targetComponentId.trim().length === 0) {
    pushIssue(issues, `${path}.targetComponentId`, 'targetComponentId is required');
  }
  if (!CONSTRAINT_RULE_TYPES.includes(rule.type)) {
    pushIssue(issues, `${path}.type`, `type must be one of: ${CONSTRAINT_RULE_TYPES.join(', ')}`);
  }
  if (rule.mode !== undefined && !LAYOUT_MODES.includes(rule.mode)) {
    pushIssue(issues, `${path}.mode`, `mode must be one of: ${LAYOUT_MODES.join(', ')}`);
  }

  return { ok: issues.length === 0, issues };
}
