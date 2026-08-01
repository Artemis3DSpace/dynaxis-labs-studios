const TOKEN_NAME_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export const DESIGN_TOKEN_GROUPS = Object.freeze(['color', 'spacing', 'typography']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

function normalizeTokenName(name) {
  if (typeof name !== 'string') {
    return null;
  }
  const normalized = name.trim().toLowerCase();
  if (!normalized || !TOKEN_NAME_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeTokenReference(reference) {
  if (typeof reference !== 'string') {
    return null;
  }
  const value = reference.trim().toLowerCase();
  const delimiterIndex = value.indexOf('.');
  if (delimiterIndex <= 0 || delimiterIndex === value.length - 1) {
    return null;
  }
  const group = value.slice(0, delimiterIndex);
  const tokenName = value.slice(delimiterIndex + 1);
  if (!DESIGN_TOKEN_GROUPS.includes(group)) {
    return null;
  }
  if (!TOKEN_NAME_PATTERN.test(tokenName)) {
    return null;
  }
  return `${group}.${tokenName}`;
}

/**
 * @param {unknown} tokenSet
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>, tokenIndex: Record<string, true>}}
 */
export function validateDesignTokenSet(tokenSet) {
  const issues = [];
  const tokenIndex = {};
  const seenNames = new Set();

  if (!isPlainObject(tokenSet)) {
    return {
      ok: false,
      issues: [issue('$', 'token set must be an object')],
      tokenIndex,
    };
  }

  for (const group of DESIGN_TOKEN_GROUPS) {
    const tokens = tokenSet[group];
    if (!Array.isArray(tokens)) {
      issues.push(issue(group, `${group} tokens must be an array`));
      continue;
    }
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const basePath = `${group}[${i}]`;
      if (!isPlainObject(token)) {
        issues.push(issue(basePath, 'token entry must be an object'));
        continue;
      }
      const tokenName = normalizeTokenName(token.name);
      if (!tokenName) {
        issues.push(issue(`${basePath}.name`, 'token name is required and must be normalized'));
        continue;
      }
      const key = `${group}.${tokenName}`;
      if (seenNames.has(key)) {
        issues.push(issue(`${basePath}.name`, `duplicate token name: ${key}`));
      } else {
        seenNames.add(key);
        tokenIndex[key] = true;
      }
      if (typeof token.value !== 'string' || token.value.trim().length === 0) {
        issues.push(issue(`${basePath}.value`, 'token value is required'));
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    tokenIndex,
  };
}

/**
 * @param {unknown} reference
 * @param {Record<string, true>} [tokenIndex]
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>, value: string | null}}
 */
export function validateColorTokenReference(reference, tokenIndex) {
  return validateTypedTokenReference('color', reference, tokenIndex, 'colorReference');
}

/**
 * @param {unknown} reference
 * @param {Record<string, true>} [tokenIndex]
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>, value: string | null}}
 */
export function validateSpacingTokenReference(reference, tokenIndex) {
  return validateTypedTokenReference('spacing', reference, tokenIndex, 'spacingReference');
}

/**
 * @param {unknown} reference
 * @param {Record<string, true>} [tokenIndex]
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>, value: string | null}}
 */
export function validateTypographyTokenReference(reference, tokenIndex) {
  return validateTypedTokenReference('typography', reference, tokenIndex, 'typographyReference');
}

function validateTypedTokenReference(expectedGroup, reference, tokenIndex, path) {
  const normalized = normalizeTokenReference(reference);
  const issues = [];
  if (!normalized) {
    issues.push(issue(path, `token reference must match ${expectedGroup}.<token_name>`));
    return { ok: false, issues, value: null };
  }

  if (!normalized.startsWith(`${expectedGroup}.`)) {
    issues.push(issue(path, `token reference must use ${expectedGroup} group`));
  }

  if (tokenIndex && !tokenIndex[normalized]) {
    issues.push(issue(path, `unknown token reference: ${normalized}`));
  }

  return {
    ok: issues.length === 0,
    issues,
    value: normalized,
  };
}
