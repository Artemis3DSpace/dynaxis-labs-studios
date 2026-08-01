function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

export function validateResponsiveVisibilityRules(rules, breakpointNames, { path = 'visibilityRules' } = {}) {
  const issues = [];
  if (!Array.isArray(rules)) {
    pushIssue(issues, path, 'visibility rules must be an array');
    return { ok: false, issues };
  }

  const knownBreakpoints = new Set(breakpointNames || []);
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const rulePath = `${path}[${i}]`;
    if (!isPlainObject(rule)) {
      pushIssue(issues, rulePath, 'visibility rule must be an object');
      continue;
    }
    if (typeof rule.componentId !== 'string' || rule.componentId.trim().length === 0) {
      pushIssue(issues, `${rulePath}.componentId`, 'componentId is required');
    }
    if (!Array.isArray(rule.visibleAt)) {
      pushIssue(issues, `${rulePath}.visibleAt`, 'visibleAt must be an array of breakpoint names');
      continue;
    }
    for (let n = 0; n < rule.visibleAt.length; n += 1) {
      const name = rule.visibleAt[n];
      if (typeof name !== 'string' || name.trim().length === 0) {
        pushIssue(issues, `${rulePath}.visibleAt[${n}]`, 'breakpoint name must be a non-empty string');
      } else if (!knownBreakpoints.has(name)) {
        pushIssue(
          issues,
          `${rulePath}.visibleAt[${n}]`,
          `unknown breakpoint "${name}" in visibility rule`
        );
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
