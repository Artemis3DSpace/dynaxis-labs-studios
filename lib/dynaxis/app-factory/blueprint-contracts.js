function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateBlueprintContract(blueprint) {
  const issues = [];
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    issues.push({ path: '$', message: 'blueprint must be an object' });
    return { ok: false, issues };
  }
  if (!isNonEmptyString(blueprint.id)) {
    issues.push({ path: 'id', message: 'blueprint id is required' });
  }
  if (!isNonEmptyString(blueprint.name)) {
    issues.push({ path: 'name', message: 'blueprint name is required' });
  }
  if (
    blueprint.requiredCapabilities !== undefined &&
    (!Array.isArray(blueprint.requiredCapabilities) ||
      blueprint.requiredCapabilities.some((item) => !isNonEmptyString(item)))
  ) {
    issues.push({
      path: 'requiredCapabilities',
      message: 'requiredCapabilities must be an array of non-empty capability ids',
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}
