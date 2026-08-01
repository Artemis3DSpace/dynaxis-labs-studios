function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

/**
 * @param {unknown} variant
 * @param {Iterable<string>} componentIds
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateComponentVariantContract(variant, componentIds) {
  const issues = [];
  if (!isPlainObject(variant)) {
    return {
      ok: false,
      issues: [issue('$', 'component variant must be an object')],
    };
  }

  if (typeof variant.id !== 'string' || variant.id.trim().length === 0) {
    issues.push(issue('id', 'variant id is required'));
  }
  if (typeof variant.componentId !== 'string' || variant.componentId.trim().length === 0) {
    issues.push(issue('componentId', 'componentId is required'));
  }
  if (typeof variant.name !== 'string' || variant.name.trim().length === 0) {
    issues.push(issue('name', 'variant name is required'));
  }

  const componentSet = new Set(componentIds || []);
  if (variant.componentId && !componentSet.has(variant.componentId)) {
    issues.push(issue('componentId', `unknown component id: ${variant.componentId}`));
  }

  if (variant.slotOverrides !== undefined && !isPlainObject(variant.slotOverrides)) {
    issues.push(issue('slotOverrides', 'slotOverrides must be an object when provided'));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
