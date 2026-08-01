export const APP_FACTORY_COMPONENT_VERIFICATION_STATES = Object.freeze([
  'EXPERIMENTAL',
  'GENERATED',
  'TESTED',
  'PRODUCTION',
  'DYNAXIS_VERIFIED',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateComponentContract(component) {
  const issues = [];
  if (!component || typeof component !== 'object' || Array.isArray(component)) {
    issues.push({ path: '$', message: 'component must be an object' });
    return { ok: false, issues };
  }
  if (!isNonEmptyString(component.id)) {
    issues.push({ path: 'id', message: 'component id is required' });
  }
  if (!isNonEmptyString(component.name)) {
    issues.push({ path: 'name', message: 'component name is required' });
  }
  if (!isNonEmptyString(component.version)) {
    issues.push({ path: 'version', message: 'component version is required' });
  }
  if (!isNonEmptyString(component.framework)) {
    issues.push({ path: 'framework', message: 'component framework is required' });
  }
  if (
    component.verificationState !== undefined &&
    !APP_FACTORY_COMPONENT_VERIFICATION_STATES.includes(component.verificationState)
  ) {
    issues.push({
      path: 'verificationState',
      message: 'verificationState is not in the supported lifecycle vocabulary',
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}
