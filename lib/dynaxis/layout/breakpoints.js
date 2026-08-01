export const BREAKPOINT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

export function validateViewportRange(range, { path = 'range' } = {}) {
  const issues = [];
  if (!isPlainObject(range)) {
    pushIssue(issues, path, 'viewport range must be an object');
    return { ok: false, issues };
  }

  if (!Number.isInteger(range.minWidth) || range.minWidth < 0) {
    pushIssue(issues, `${path}.minWidth`, 'minWidth must be an integer >= 0');
  }
  const hasMax = range.maxWidth !== null && range.maxWidth !== undefined;
  if (hasMax && (!Number.isInteger(range.maxWidth) || range.maxWidth < 0)) {
    pushIssue(issues, `${path}.maxWidth`, 'maxWidth must be null or an integer >= 0');
  }
  if (
    Number.isInteger(range.minWidth) &&
    Number.isInteger(range.maxWidth) &&
    range.maxWidth < range.minWidth
  ) {
    pushIssue(issues, path, 'maxWidth must be greater than or equal to minWidth');
  }

  return { ok: issues.length === 0, issues };
}

export function validateBreakpointSet(breakpointSet, { path = 'breakpointSet' } = {}) {
  const issues = [];
  if (!isPlainObject(breakpointSet)) {
    pushIssue(issues, path, 'breakpoint set must be an object');
    return { ok: false, issues };
  }
  if (typeof breakpointSet.name !== 'string' || breakpointSet.name.trim().length === 0) {
    pushIssue(issues, `${path}.name`, 'breakpoint set name is required');
  }
  if (!Array.isArray(breakpointSet.breakpoints) || breakpointSet.breakpoints.length === 0) {
    pushIssue(issues, `${path}.breakpoints`, 'breakpoints must be a non-empty array');
    return { ok: false, issues };
  }

  const seenNames = new Set();
  const normalized = [];
  for (let i = 0; i < breakpointSet.breakpoints.length; i += 1) {
    const breakpoint = breakpointSet.breakpoints[i];
    const itemPath = `${path}.breakpoints[${i}]`;
    if (!isPlainObject(breakpoint)) {
      pushIssue(issues, itemPath, 'breakpoint must be an object');
      continue;
    }

    if (typeof breakpoint.name !== 'string' || !BREAKPOINT_NAME_PATTERN.test(breakpoint.name)) {
      pushIssue(issues, `${itemPath}.name`, 'breakpoint name must match /^[a-z][a-z0-9-]*$/');
    } else if (seenNames.has(breakpoint.name)) {
      pushIssue(issues, `${itemPath}.name`, 'breakpoint names must be unique');
    } else {
      seenNames.add(breakpoint.name);
    }

    const rangeResult = validateViewportRange(
      { minWidth: breakpoint.minWidth, maxWidth: breakpoint.maxWidth },
      { path: itemPath }
    );
    issues.push(...rangeResult.issues);
    if (rangeResult.ok) {
      normalized.push({
        name: breakpoint.name,
        minWidth: breakpoint.minWidth,
        maxWidth: breakpoint.maxWidth ?? null,
      });
    }
  }

  const sorted = normalized.sort((a, b) => a.minWidth - b.minWidth);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.maxWidth === null || previous.maxWidth >= current.minWidth) {
      pushIssue(
        issues,
        path,
        `breakpoint ranges overlap between "${previous.name}" and "${current.name}"`
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
