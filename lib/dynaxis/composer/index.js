/**
 * Dynaxis Composer domain contracts.
 *
 * This module is intentionally domain-only: no persistence, worker runtimes,
 * provider connection lookups, or job-engine integrations.
 */

export {
  sequenceSchema,
  parseComposerSequence,
  validateComposerSequence,
} from './sequence.js';
export {
  timelineSchema,
  validateTimelineRules,
} from './timeline.js';
export {
  trackSchema,
  validateTrackRules,
} from './tracks.js';
export {
  clipSchema,
  clipKinds,
  validateClipTiming,
} from './clips.js';
export {
  mediaReferenceSchema,
  generativeBlockPlaceholderSchema,
  assertNoProviderConnectionSecrets,
} from './media-contracts.js';
export {
  effectInstanceSchema,
  effectStackSchema,
  exportTargetSchema,
} from './effects-contracts.js';
export {
  renderGraphSchema,
  renderGraphNodeSchema,
  renderGraphEdgeSchema,
  validateRenderGraphAcyclic,
  parseRenderGraph,
} from './render-graph.js';
