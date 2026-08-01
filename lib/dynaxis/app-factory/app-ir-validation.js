import { APP_IR_V0_FIELD_KEYS } from './app-ir.js';
import { assertAppIrVersionCompatible } from './app-ir-versioning.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

function hasRawSecretValue(entry) {
  return typeof entry.value === 'string' && entry.value.trim().length > 0;
}

function hasProvenance(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

export function validateAppIr(appIr, { requireGeneratedProvenance = true } = {}) {
  const issues = [];
  if (!isPlainObject(appIr)) {
    pushIssue(issues, '$', 'App IR must be an object');
    return { ok: false, issues };
  }

  for (const key of APP_IR_V0_FIELD_KEYS) {
    if (!(key in appIr)) {
      pushIssue(issues, key, 'Required field is missing');
    }
  }

  if (typeof appIr.appId !== 'string' || appIr.appId.trim().length === 0) {
    pushIssue(issues, 'appId', 'appId must be a non-empty string');
  }
  if (typeof appIr.name !== 'string' || appIr.name.trim().length === 0) {
    pushIssue(issues, 'name', 'name must be a non-empty string');
  }
  if (typeof appIr.version !== 'string' || appIr.version.trim().length === 0) {
    pushIssue(issues, 'version', 'version must be provided');
  } else {
    try {
      assertAppIrVersionCompatible(appIr.version);
    } catch (err) {
      pushIssue(issues, 'version', err.message);
    }
  }

  const pages = Array.isArray(appIr.pages) ? appIr.pages : [];
  const pageIds = new Set();
  if (!Array.isArray(appIr.pages)) pushIssue(issues, 'pages', 'pages must be an array');
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    if (!isPlainObject(page) || typeof page.id !== 'string' || page.id.trim().length === 0) {
      pushIssue(issues, `pages[${i}]`, 'page requires a non-empty id');
      continue;
    }
    pageIds.add(page.id);
  }

  if (!Array.isArray(appIr.routes)) pushIssue(issues, 'routes', 'routes must be an array');
  for (let i = 0; i < (appIr.routes || []).length; i += 1) {
    const route = appIr.routes[i];
    if (!isPlainObject(route)) {
      pushIssue(issues, `routes[${i}]`, 'route must be an object');
      continue;
    }
    if (typeof route.path !== 'string' || !route.path.startsWith('/')) {
      pushIssue(issues, `routes[${i}].path`, 'route path must start with "/"');
    }
    if (typeof route.pageId !== 'string' || !pageIds.has(route.pageId)) {
      pushIssue(issues, `routes[${i}].pageId`, 'route pageId must reference an existing page');
    }
  }

  if (!Array.isArray(appIr.dataSources)) pushIssue(issues, 'dataSources', 'dataSources must be an array');
  if (!Array.isArray(appIr.capabilities))
    pushIssue(issues, 'capabilities', 'capabilities must be an array');
  if (!Array.isArray(appIr.permissions)) pushIssue(issues, 'permissions', 'permissions must be an array');
  if (!Array.isArray(appIr.assets)) pushIssue(issues, 'assets', 'assets must be an array');
  if (!Array.isArray(appIr.buildTargets))
    pushIssue(issues, 'buildTargets', 'buildTargets must be an array');

  if (!Array.isArray(appIr.components)) pushIssue(issues, 'components', 'components must be an array');
  for (let i = 0; i < (appIr.components || []).length; i += 1) {
    const component = appIr.components[i];
    if (!isPlainObject(component) || typeof component.id !== 'string' || component.id.trim().length === 0) {
      pushIssue(issues, `components[${i}].id`, 'component id is required');
      continue;
    }
    if (requireGeneratedProvenance && component.generated === true && !hasProvenance(component.provenance)) {
      pushIssue(
        issues,
        `components[${i}].provenance`,
        'generated components must include provenance'
      );
    }
  }

  if (!Array.isArray(appIr.actions)) pushIssue(issues, 'actions', 'actions must be an array');
  for (let i = 0; i < (appIr.actions || []).length; i += 1) {
    const action = appIr.actions[i];
    if (!isPlainObject(action)) {
      pushIssue(issues, `actions[${i}]`, 'action must be an object');
      continue;
    }
    const hasCapabilityId =
      typeof action.capabilityId === 'string' && action.capabilityId.trim().length > 0;
    const hasCapabilitiesList =
      Array.isArray(action.capabilities) &&
      action.capabilities.some((value) => typeof value === 'string' && value.trim().length > 0);
    if (!hasCapabilityId && !hasCapabilitiesList) {
      pushIssue(issues, `actions[${i}]`, 'action must declare at least one capability');
    }
  }

  if (!Array.isArray(appIr.environmentVariables)) {
    pushIssue(issues, 'environmentVariables', 'environmentVariables must be an array');
  }
  for (let i = 0; i < (appIr.environmentVariables || []).length; i += 1) {
    const variable = appIr.environmentVariables[i];
    if (!isPlainObject(variable) || typeof variable.key !== 'string' || variable.key.trim().length === 0) {
      pushIssue(issues, `environmentVariables[${i}]`, 'environment variable key is required');
      continue;
    }
    if (hasRawSecretValue(variable)) {
      pushIssue(
        issues,
        `environmentVariables[${i}].value`,
        'raw secret values are forbidden; use secretRef'
      );
    }
  }

  if (!isPlainObject(appIr.verificationState)) {
    pushIssue(issues, 'verificationState', 'verificationState must be an object');
  }
  if (!isPlainObject(appIr.provenance)) {
    pushIssue(issues, 'provenance', 'provenance must be an object');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function assertValidAppIr(appIr, options = {}) {
  const result = validateAppIr(appIr, options);
  if (!result.ok) {
    const err = new Error('App IR validation failed');
    err.code = 'APP_IR_VALIDATION_ERROR';
    err.issues = result.issues;
    throw err;
  }
  return appIr;
}
