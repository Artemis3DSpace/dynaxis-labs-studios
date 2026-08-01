export const AUTO_LAYOUT_MODES = Object.freeze(['stack', 'row', 'grid']);
export const AUTO_LAYOUT_SIZE_BEHAVIORS = Object.freeze(['fill', 'hug', 'fixed']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

function hasAbsolutePositioning(frame = {}) {
  const keys = ['x', 'y', 'left', 'top', 'right', 'bottom'];
  return keys.some((key) => frame[key] !== undefined && frame[key] !== null);
}

function hasUnsafeAbsoluteSize(size = {}) {
  return (
    (typeof size.width === 'string' && size.width.trim().endsWith('px')) ||
    (typeof size.height === 'string' && size.height.trim().endsWith('px'))
  );
}

export function validateAutoLayoutIntent(intent, { constrainedLayoutRequired = true } = {}) {
  const issues = [];
  if (!isPlainObject(intent)) {
    pushIssue(issues, 'autoLayoutIntent', 'auto layout intent must be an object');
    return { ok: false, issues };
  }

  if (!AUTO_LAYOUT_MODES.includes(intent.mode)) {
    pushIssue(issues, 'autoLayoutIntent.mode', `mode must be one of: ${AUTO_LAYOUT_MODES.join(', ')}`);
  }
  if (!isPlainObject(intent.sizeBehavior)) {
    pushIssue(issues, 'autoLayoutIntent.sizeBehavior', 'sizeBehavior must be an object');
  } else {
    for (const axis of ['width', 'height']) {
      if (!AUTO_LAYOUT_SIZE_BEHAVIORS.includes(intent.sizeBehavior[axis])) {
        pushIssue(
          issues,
          `autoLayoutIntent.sizeBehavior.${axis}`,
          `size behavior must be one of: ${AUTO_LAYOUT_SIZE_BEHAVIORS.join(', ')}`
        );
      }
    }
  }

  if (constrainedLayoutRequired) {
    if (hasAbsolutePositioning(intent.frame)) {
      pushIssue(
        issues,
        'autoLayoutIntent.frame',
        'absolute frame coordinates are forbidden when constrained layout is required'
      );
    }
    if (hasUnsafeAbsoluteSize(intent.size)) {
      pushIssue(
        issues,
        'autoLayoutIntent.size',
        'px-based absolute size is forbidden when constrained layout is required'
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
