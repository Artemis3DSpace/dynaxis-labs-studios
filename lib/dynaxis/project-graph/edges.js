/**
 * Phase 7F edge taxonomy scaffold.
 */

import { isGraphNodeKind, isGraphRelationshipName } from './ontology.js';

export const PROJECT_GRAPH_EDGE_KINDS = /** @type {const} */ ([
  'workspace_contains_project',
  'project_contains_asset',
  'project_contains_job',
  'project_contains_generation',
  'project_has_conversation',
  'conversation_has_message',
  'project_has_memory_record',
  'project_has_decision_record',
  'decision_record_references_memory_record',
  'job_generates_asset',
  'generation_produces_asset',
  'agent_role_executes_work_package',
  'work_package_requires_capability',
  'work_package_targets_model_domain',
  'verification_gate_verifies_work_package',
]);

/**
 * @param {unknown} kind
 * @returns {string|null}
 */
export function normalizeGraphEdgeKind(kind) {
  if (!isGraphRelationshipName(kind)) return null;
  return String(kind).trim().toLowerCase();
}

/**
 * @param {unknown} kind
 * @returns {boolean}
 */
export function isGraphEdgeKind(kind) {
  const normalized = normalizeGraphEdgeKind(kind);
  return normalized != null && PROJECT_GRAPH_EDGE_KINDS.includes(normalized);
}

/**
 * @typedef {Object} GraphEdgeContract
 * @property {string} source
 * @property {string} target
 * @property {string} kind
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {unknown} edge
 * @returns {GraphEdgeContract}
 */
export function validateGraphEdge(edge) {
  if (!edge || typeof edge !== 'object') {
    throw new Error('Graph edge must be an object');
  }
  const source = String(edge.source || '').trim();
  const target = String(edge.target || '').trim();
  const kind = normalizeGraphEdgeKind(edge.kind);

  if (!source) throw new Error('Graph edge requires source');
  if (!target) throw new Error('Graph edge requires target');
  if (!kind) throw new Error('Graph edge requires kind');
  if (!isGraphEdgeKind(kind)) throw new Error(`Unknown graph edge kind: ${kind}`);
  if (edge.sourceKind && !isGraphNodeKind(edge.sourceKind)) {
    throw new Error(`Unknown source node kind: ${edge.sourceKind}`);
  }
  if (edge.targetKind && !isGraphNodeKind(edge.targetKind)) {
    throw new Error(`Unknown target node kind: ${edge.targetKind}`);
  }

  return {
    source,
    target,
    kind,
    metadata: edge.metadata && typeof edge.metadata === 'object' ? { ...edge.metadata } : {},
  };
}
