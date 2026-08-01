/**
 * Phase 7F ontology scaffold.
 * Contract-only vocabulary for graph node typing and relationship naming.
 */

export const PROJECT_GRAPH_NODE_KINDS = /** @type {const} */ ([
  'workspace',
  'project',
  'asset',
  'generation',
  'job',
  'conversation',
  'message',
  'memory_record',
  'decision_record',
  'agent_role',
  'work_package',
  'verification_gate',
  'capability',
  'model_domain',
]);

const graphKindPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const relationshipNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/**
 * @param {unknown} kind
 * @returns {string|null}
 */
export function normalizeGraphNodeKind(kind) {
  const value = String(kind || '')
    .trim()
    .toLowerCase();
  if (!value || !graphKindPattern.test(value)) return null;
  return value;
}

/**
 * @param {unknown} kind
 * @returns {boolean}
 */
export function isGraphNodeKind(kind) {
  const normalized = normalizeGraphNodeKind(kind);
  return normalized != null && PROJECT_GRAPH_NODE_KINDS.includes(normalized);
}

/**
 * Graph relationship names are contract identifiers, not free text.
 * They are snake_case, lowercase, and stable across persistence/runtime layers.
 *
 * @param {unknown} name
 * @returns {string|null}
 */
export function normalizeGraphRelationshipName(name) {
  const value = String(name || '')
    .trim()
    .toLowerCase();
  if (!value || !relationshipNamePattern.test(value)) return null;
  return value;
}

/**
 * @param {unknown} name
 * @returns {boolean}
 */
export function isGraphRelationshipName(name) {
  return normalizeGraphRelationshipName(name) != null;
}
