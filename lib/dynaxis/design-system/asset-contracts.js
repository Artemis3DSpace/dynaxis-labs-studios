export const DESIGN_ASSET_KINDS = Object.freeze(['icon', 'illustration', 'font', 'motion']);

const SECRET_LIKE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /begin\s+private\s+key/i,
  /sk-[a-z0-9]/i,
  /xox[baprs]-/i,
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(path, message) {
  return { path, message };
}

function hasSecretLikeText(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * @param {unknown} asset
 * @returns {{ok: boolean, issues: Array<{path: string, message: string}>}}
 */
export function validateAssetReferenceContract(asset) {
  const issues = [];
  if (!isPlainObject(asset)) {
    return {
      ok: false,
      issues: [issue('$', 'asset reference must be an object')],
    };
  }

  if (typeof asset.id !== 'string' || asset.id.trim().length === 0) {
    issues.push(issue('id', 'asset id is required'));
  }
  if (!DESIGN_ASSET_KINDS.includes(asset.kind)) {
    issues.push(issue('kind', `asset kind must be one of: ${DESIGN_ASSET_KINDS.join(', ')}`));
  }
  if (typeof asset.uri !== 'string' || asset.uri.trim().length === 0) {
    issues.push(issue('uri', 'asset uri is required'));
  }
  if (hasSecretLikeText(asset.uri)) {
    issues.push(issue('uri', 'asset uri must not include secret-like raw values'));
  }

  if (isPlainObject(asset.metadata)) {
    for (const [key, value] of Object.entries(asset.metadata)) {
      if (hasSecretLikeText(key) || hasSecretLikeText(value)) {
        issues.push(issue(`metadata.${key}`, 'asset metadata must not include secret-like raw values'));
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
