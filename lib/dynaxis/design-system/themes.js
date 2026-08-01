import {
  validateColorTokenReference,
  validateSpacingTokenReference,
  validateTypographyTokenReference,
} from './tokens.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

/**
 * @param {unknown} theme
 * @param {Record<string, true>} [tokenIndex]
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateThemeContract(theme, tokenIndex) {
  const issues = [];
  if (!isPlainObject(theme)) {
    return {
      ok: false,
      issues: [issue('$', 'theme contract must be an object')],
    };
  }

  if (typeof theme.id !== 'string' || theme.id.trim().length === 0) {
    issues.push(issue('id', 'theme id is required'));
  }
  if (typeof theme.name !== 'string' || theme.name.trim().length === 0) {
    issues.push(issue('name', 'theme name is required'));
  }

  if (!isPlainObject(theme.tokenRefs)) {
    issues.push(issue('tokenRefs', 'theme requires token references'));
    return { ok: false, issues };
  }

  const colorResult = validateColorTokenReference(theme.tokenRefs.color, tokenIndex);
  issues.push(...colorResult.issues.map((entry) => issue(`tokenRefs.${entry.path}`, entry.message)));

  const spacingResult = validateSpacingTokenReference(theme.tokenRefs.spacing, tokenIndex);
  issues.push(...spacingResult.issues.map((entry) => issue(`tokenRefs.${entry.path}`, entry.message)));

  const typographyResult = validateTypographyTokenReference(theme.tokenRefs.typography, tokenIndex);
  issues.push(...typographyResult.issues.map((entry) => issue(`tokenRefs.${entry.path}`, entry.message)));

  return {
    ok: issues.length === 0,
    issues,
  };
}
