/**
 * Dynaxis Campaign public exports (client-safe).
 * Server-only generation/services must not be re-exported here.
 */

export {
  CAMPAIGN_GOALS,
  CAMPAIGN_GOAL_IDS,
  getCampaignGoal,
  isCampaignGoalId,
} from './goals.js';

export {
  CAMPAIGN_FORMATS,
  CAMPAIGN_FORMAT_IDS,
  getCampaignFormat,
  isCampaignFormatId,
  mapRecommendedFormatIds,
  countWords,
  validateFormatCopy,
  truncateToMaxWords,
} from './formats.js';

export {
  CONCEPT_COUNT,
  campaignConceptDraftSchema,
  campaignConceptsArraySchema,
  parseConceptsJson,
  validateConceptDrafts,
  CAMPAIGN_CONCEPT_SYSTEM_PROMPT,
  buildConceptUserPrompt,
} from './concepts.js';

export {
  deliverableCopySchema,
  parseCopyJson,
  enforceFormatCopy,
  buildCopyUserPrompt,
  buildCampaignImagePrompt,
  CAMPAIGN_COPY_SYSTEM_PROMPT,
} from './copy.js';

export {
  CAMPAIGN_MAX_REFERENCE_IMAGES,
  buildOrderedCampaignReferences,
  assertCampaignReferenceBudget,
} from './references.js';

export {
  buildCampaignContext,
  resolveCampaignContext,
  publishCampaignGenerationContext,
  clearCampaignGenerationContext,
  readCampaignGenerationContext,
} from './consumer.js';
