/**
 * Dynaxis Design Templates — client-safe exports.
 */

export {
  templateDocumentSchema,
  templateSlotSchema,
  templateTextSlotSchema,
  templateImageSlotSchema,
  parseTemplateDocument,
  compositionDocumentToTemplateDocument,
  templateDocumentToCompositionDocument,
  collectTemplateDocumentAssetIds,
} from './document.js';

export {
  templateBindingContextSchema,
  parseTemplateBindingContext,
  resolveTextSlotValue,
  resolveImageSlotValue,
  bindTemplateSlots,
} from './binding.js';

export {
  adaptCompositionDocument,
  resolveTargetCanvas,
  safeAreaForFormat,
  ADAPTATION_ENGINE_VERSION,
} from './adapt.js';

export {
  DESIGN_TEMPLATE_CATEGORIES,
  DESIGN_TEMPLATE_STATUSES,
  isDesignTemplateCategory,
  isDesignTemplateStatus,
  normalizeTemplateTags,
} from './categories.js';
