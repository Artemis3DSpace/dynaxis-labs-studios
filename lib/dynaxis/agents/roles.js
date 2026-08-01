/**
 * Phase 7I agent role vocabulary scaffold.
 */

export const AGENT_ROLE_NAMES = /** @type {const} */ ([
  'planner',
  'implementer',
  'reviewer',
  'verifier',
  'release_manager',
  'observer',
]);

export const AGENT_ACTION_CATEGORIES = /** @type {const} */ ([
  'plan',
  'read',
  'write',
  'test',
  'verify',
  'report',
]);

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeValue(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || null;
}

/**
 * @param {unknown} role
 * @returns {string|null}
 */
export function normalizeAgentRoleName(role) {
  const normalized = normalizeValue(role);
  return normalized && AGENT_ROLE_NAMES.includes(normalized) ? normalized : null;
}

/**
 * @param {unknown} action
 * @returns {string|null}
 */
export function normalizeAgentActionCategory(action) {
  const normalized = normalizeValue(action);
  return normalized && AGENT_ACTION_CATEGORIES.includes(normalized) ? normalized : null;
}
