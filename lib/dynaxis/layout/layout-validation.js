import { validateAutoLayoutIntent } from './auto-layout.js';
import { validateBreakpointSet } from './breakpoints.js';
import { LAYOUT_MODES, validateConstraintRule, validateSpacingTokens } from './constraints.js';
import { validateGridTracks } from './grid.js';
import { validateResponsiveVisibilityRules } from './responsive-rules.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

function scanForRawSecrets(value, path, issues) {
  if (typeof value === 'string') {
    const lowerPath = path.toLowerCase();
    if (
      lowerPath.includes('secret') ||
      lowerPath.includes('apikey') ||
      lowerPath.includes('api-key') ||
      lowerPath.includes('token') ||
      lowerPath.includes('password')
    ) {
      if (value.trim().length > 0) {
        pushIssue(issues, path, 'raw secret-like values are forbidden in layout metadata');
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      scanForRawSecrets(value[i], `${path}[${i}]`, issues);
    }
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      scanForRawSecrets(nested, path ? `${path}.${key}` : key, issues);
    }
  }
}

function validateLayoutContainer(container, path) {
  const issues = [];
  if (!isPlainObject(container)) {
    pushIssue(issues, path, 'layout container must be an object');
    return { ok: false, issues };
  }
  if (typeof container.id !== 'string' || container.id.trim().length === 0) {
    pushIssue(issues, `${path}.id`, 'layout container id is required');
  }
  if (!LAYOUT_MODES.includes(container.mode)) {
    pushIssue(issues, `${path}.mode`, `mode must be one of: ${LAYOUT_MODES.join(', ')}`);
  }
  return { ok: issues.length === 0, issues };
}

function validateComponentLayoutMetadata(entry, path) {
  const issues = [];
  if (!isPlainObject(entry)) {
    pushIssue(issues, path, 'component layout metadata must be an object');
    return { ok: false, issues };
  }
  if (typeof entry.componentId !== 'string' || entry.componentId.trim().length === 0) {
    pushIssue(issues, `${path}.componentId`, 'componentId is required');
  }
  if (entry.mode !== undefined && !LAYOUT_MODES.includes(entry.mode)) {
    pushIssue(issues, `${path}.mode`, `mode must be one of: ${LAYOUT_MODES.join(', ')}`);
  }
  if (entry.autoLayoutIntent !== undefined) {
    const autoLayoutResult = validateAutoLayoutIntent(entry.autoLayoutIntent);
    for (const issue of autoLayoutResult.issues) {
      pushIssue(issues, `${path}.${issue.path}`, issue.message);
    }
  }
  if (Array.isArray(entry.constraints)) {
    for (let i = 0; i < entry.constraints.length; i += 1) {
      const constraintResult = validateConstraintRule(entry.constraints[i], {
        path: `${path}.constraints[${i}]`,
      });
      issues.push(...constraintResult.issues);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateLayoutMetadata(metadata) {
  const issues = [];
  if (!isPlainObject(metadata)) {
    pushIssue(issues, '$', 'layout metadata must be an object');
    return { ok: false, issues };
  }

  const breakpointResult = validateBreakpointSet(metadata.breakpointSet, { path: 'breakpointSet' });
  issues.push(...breakpointResult.issues);

  const spacingResult = validateSpacingTokens(metadata.spacingTokens || {}, { path: 'spacingTokens' });
  issues.push(...spacingResult.issues);

  if (Array.isArray(metadata.containers)) {
    for (let i = 0; i < metadata.containers.length; i += 1) {
      const containerResult = validateLayoutContainer(metadata.containers[i], `containers[${i}]`);
      issues.push(...containerResult.issues);
    }
  } else {
    pushIssue(issues, 'containers', 'containers must be an array');
  }

  if (Array.isArray(metadata.grids)) {
    for (let i = 0; i < metadata.grids.length; i += 1) {
      const gridResult = validateGridTracks(metadata.grids[i], { path: `grids[${i}]` });
      issues.push(...gridResult.issues);
    }
  } else {
    pushIssue(issues, 'grids', 'grids must be an array');
  }

  const breakpointNames = Array.isArray(metadata.breakpointSet?.breakpoints)
    ? metadata.breakpointSet.breakpoints.map((entry) => entry.name)
    : [];
  const visibilityResult = validateResponsiveVisibilityRules(
    metadata.visibilityRules || [],
    breakpointNames,
    { path: 'visibilityRules' }
  );
  issues.push(...visibilityResult.issues);

  if (Array.isArray(metadata.components)) {
    for (let i = 0; i < metadata.components.length; i += 1) {
      const componentResult = validateComponentLayoutMetadata(metadata.components[i], `components[${i}]`);
      issues.push(...componentResult.issues);
    }
  } else {
    pushIssue(issues, 'components', 'components must be an array');
  }

  scanForRawSecrets(metadata, '', issues);

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function assertValidLayoutMetadata(metadata) {
  const result = validateLayoutMetadata(metadata);
  if (!result.ok) {
    const error = new Error('Layout metadata validation failed');
    error.code = 'LAYOUT_VALIDATION_ERROR';
    error.issues = result.issues;
    throw error;
  }
  return metadata;
}
