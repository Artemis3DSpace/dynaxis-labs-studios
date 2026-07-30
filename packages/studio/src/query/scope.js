/**
 * Canonical client query scope helpers.
 * Keys are workspace- and project-scoped; legacy owner_ref is never accepted.
 */

const OWNER_REF_KEY_PATTERN = /^owner_ref$|^ownerRef$/i;

/**
 * @param {unknown} organizationId Better Auth active Workspace organization id.
 * @returns {string}
 */
export function requireOrganizationId(organizationId) {
  const value = organizationId == null ? '' : String(organizationId).trim();
  if (!value) {
    throw new Error('organizationId is required for Dynaxis query keys');
  }
  return value;
}

/**
 * @param {unknown} projectId Canonical Dynaxis Project id.
 * @returns {string}
 */
export function requireProjectId(projectId) {
  const value = projectId == null ? '' : String(projectId).trim();
  if (!value) {
    throw new Error('projectId is required for project-scoped Dynaxis query keys');
  }
  return value;
}

/**
 * @param {Record<string, unknown> | null | undefined} filters
 * @returns {Record<string, unknown>}
 */
export function stableFilterScope(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return {};
  }
  const entries = Object.entries(filters).filter(
    ([key, value]) => !OWNER_REF_KEY_PATTERN.test(key) && value !== undefined
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

/**
 * Reject legacy owner_ref partition keys from client query scope.
 * @param {Record<string, unknown> | null | undefined} scope
 */
export function assertNoOwnerRefScope(scope) {
  if (!scope || typeof scope !== 'object') return;
  for (const key of Object.keys(scope)) {
    if (OWNER_REF_KEY_PATTERN.test(key)) {
      throw new Error('owner_ref must not appear in Dynaxis query key scope');
    }
    if (key === 'owner_ref' || scope[key] === 'owner_ref') {
      throw new Error('owner_ref must not appear in Dynaxis query key scope');
    }
  }
}

/**
 * @param {{ organizationId?: unknown, projectId?: unknown, filters?: Record<string, unknown> }} scope
 */
export function normalizeWorkspaceScope(scope = {}) {
  assertNoOwnerRefScope(scope);
  assertNoOwnerRefScope(scope.filters);
  return {
    organizationId: requireOrganizationId(scope.organizationId),
    filters: stableFilterScope(scope.filters),
  };
}

/**
 * @param {{ organizationId?: unknown, projectId?: unknown, filters?: Record<string, unknown> }} scope
 */
export function normalizeProjectScope(scope = {}) {
  const workspace = normalizeWorkspaceScope(scope);
  return {
    ...workspace,
    projectId: requireProjectId(scope.projectId),
  };
}
