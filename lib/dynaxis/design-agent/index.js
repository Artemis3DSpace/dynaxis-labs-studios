/**
 * Dynaxis Design Agent — client-safe exports.
 */

export {
  designOperationSchema,
  designOperationBatchSchema,
  designActionPlanSchema,
  parseDesignOperationBatch,
  parseDesignActionPlan,
  applyDesignOperations,
  extractDesignActionPlanFromText,
  DESIGN_AGENT_MAX_OPERATIONS,
  DESIGN_AGENT_STALE_CODE,
} from './operations.js';

export {
  projectBrandContextForAgent,
  projectProductContextForAgent,
  projectCharacterContextForAgent,
  projectCampaignContextForAgent,
  projectCompositionForAgent,
} from './context.js';
