/**
 * Phase 7I work-package runtime contract scaffold.
 */

import { normalizeAgentRoleName } from './roles.js';

export const WORK_PACKAGE_TYPES = /** @type {const} */ ([
  'specification',
  'implementation',
  'review',
  'integration',
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function requiredString(value) {
  return String(value || '').trim();
}

/**
 * @param {unknown} input
 */
export function validateWorkPackageRuntimeContract(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Work package runtime contract must be an object');
  }

  const id = requiredString(input.id);
  const phase = requiredString(input.phase);
  const title = requiredString(input.title);
  const type = requiredString(input.type).toLowerCase();

  if (!id) throw new Error('Work package requires id');
  if (!phase) throw new Error('Work package requires phase');
  if (!title) throw new Error('Work package requires title');
  if (!WORK_PACKAGE_TYPES.includes(type)) throw new Error(`Unknown work package type: ${input.type ?? ''}`);

  const assignedRole = input.assignedRole ? normalizeAgentRoleName(input.assignedRole) : null;
  if (input.assignedRole && !assignedRole) {
    throw new Error(`Unknown assigned role: ${input.assignedRole}`);
  }

  return {
    id,
    phase,
    title,
    type,
    assignedRole,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
  };
}
