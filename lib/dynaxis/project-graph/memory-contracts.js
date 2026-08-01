/**
 * Phase 7F memory and decision contract scaffold.
 */

export const MEMORY_RECORD_KINDS = /** @type {const} */ ([
  'observation',
  'fact',
  'hypothesis',
  'constraint',
  'assumption',
  'decision_input',
]);

export const DECISION_RECORD_KINDS = /** @type {const} */ ([
  'routing_decision',
  'capability_selection',
  'verification_outcome',
  'scope_denial',
]);

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeKind(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return normalized;
}

/**
 * @typedef {Object} ProvenanceContract
 * @property {string} actorType
 * @property {string} actorId
 * @property {string} source
 * @property {string} observedAt
 */

/**
 * @param {unknown} provenance
 * @returns {ProvenanceContract}
 */
export function validateProvenanceContract(provenance) {
  if (!provenance || typeof provenance !== 'object') {
    throw new Error('Provenance is required');
  }
  const actorType = String(provenance.actorType || '').trim().toLowerCase();
  const actorId = String(provenance.actorId || '').trim();
  const source = String(provenance.source || '').trim().toLowerCase();
  const observedAt = String(provenance.observedAt || '').trim();
  if (!actorType) throw new Error('Provenance requires actorType');
  if (!actorId) throw new Error('Provenance requires actorId');
  if (!source) throw new Error('Provenance requires source');
  if (!observedAt) throw new Error('Provenance requires observedAt');
  return { actorType, actorId, source, observedAt };
}

/**
 * @param {unknown} record
 */
export function validateMemoryRecordContract(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Memory record must be an object');
  }
  const kind = normalizeKind(record.kind);
  if (!kind || !MEMORY_RECORD_KINDS.includes(kind)) {
    throw new Error(`Unknown memory record kind: ${record.kind ?? ''}`);
  }
  return {
    id: String(record.id || '').trim() || null,
    kind,
    summary: String(record.summary || '').trim(),
    provenance: validateProvenanceContract(record.provenance),
    metadata: record.metadata && typeof record.metadata === 'object' ? { ...record.metadata } : {},
  };
}

/**
 * @param {unknown} record
 */
export function validateDecisionRecordContract(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Decision record must be an object');
  }
  const kind = normalizeKind(record.kind);
  if (!kind || !DECISION_RECORD_KINDS.includes(kind)) {
    throw new Error(`Unknown decision record kind: ${record.kind ?? ''}`);
  }
  return {
    id: String(record.id || '').trim() || null,
    kind,
    decision: String(record.decision || '').trim(),
    rationale: String(record.rationale || '').trim(),
    provenance: validateProvenanceContract(record.provenance),
    metadata: record.metadata && typeof record.metadata === 'object' ? { ...record.metadata } : {},
  };
}
