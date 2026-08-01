export const ACCESSIBILITY_ROLE_VOCABULARY = Object.freeze([
  'button',
  'link',
  'checkbox',
  'textbox',
  'switch',
  'menuitem',
  'tab',
  'dialog',
  'alert',
  'status',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

function hasMeaningfulLabel(value) {
  return typeof value === 'string' && value.trim().length >= 2;
}

/**
 * @param {unknown} metadata
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateAccessibilityMetadataContract(metadata) {
  const issues = [];
  if (!isPlainObject(metadata)) {
    return {
      ok: false,
      issues: [issue('$', 'accessibility metadata must be an object')],
    };
  }

  if (!ACCESSIBILITY_ROLE_VOCABULARY.includes(metadata.role)) {
    issues.push(issue('role', `role must be one of: ${ACCESSIBILITY_ROLE_VOCABULARY.join(', ')}`));
  }

  const hasLabel = hasMeaningfulLabel(metadata.label) || hasMeaningfulLabel(metadata.ariaLabel);
  if (!hasLabel) {
    issues.push(issue('label', 'accessibility metadata requires meaningful label or ariaLabel'));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
