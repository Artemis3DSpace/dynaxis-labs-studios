export const DESIGN_SYSTEM_COMPONENT_CATEGORIES = Object.freeze([
  'input',
  'navigation',
  'feedback',
  'layout',
  'data-display',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

/**
 * @param {unknown} slot
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateComponentSlotContract(slot) {
  const issues = [];
  if (!isPlainObject(slot)) {
    return {
      ok: false,
      issues: [issue('$', 'component slot must be an object')],
    };
  }
  if (typeof slot.id !== 'string' || slot.id.trim().length === 0) {
    issues.push(issue('id', 'slot id is required'));
  }
  if (typeof slot.name !== 'string' || slot.name.trim().length === 0) {
    issues.push(issue('name', 'slot name is required'));
  }
  if (slot.required !== undefined && typeof slot.required !== 'boolean') {
    issues.push(issue('required', 'slot required must be boolean when provided'));
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

/**
 * @param {unknown} component
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateComponentDefinitionContract(component) {
  const issues = [];
  if (!isPlainObject(component)) {
    return {
      ok: false,
      issues: [issue('$', 'component definition must be an object')],
    };
  }

  if (typeof component.id !== 'string' || component.id.trim().length === 0) {
    issues.push(issue('id', 'component id is required'));
  }
  if (typeof component.name !== 'string' || component.name.trim().length === 0) {
    issues.push(issue('name', 'component name is required'));
  }
  if (!DESIGN_SYSTEM_COMPONENT_CATEGORIES.includes(component.category)) {
    issues.push(issue('category', `category must be one of: ${DESIGN_SYSTEM_COMPONENT_CATEGORIES.join(', ')}`));
  }

  if (!Array.isArray(component.slots) || component.slots.length === 0) {
    issues.push(issue('slots', 'component slots are required'));
  } else {
    for (let i = 0; i < component.slots.length; i += 1) {
      const slotResult = validateComponentSlotContract(component.slots[i]);
      for (const slotIssue of slotResult.issues) {
        issues.push(issue(`slots[${i}].${slotIssue.path}`, slotIssue.message));
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

/**
 * @param {boolean} ok
 * @param {Array<{path: string, message: string}>} issues
 */
export function createDesignSystemValidationResult(ok, issues) {
  return {
    status: ok ? 'pass' : 'fail',
    ok: Boolean(ok),
    issues: Array.isArray(issues) ? [...issues] : [],
  };
}
