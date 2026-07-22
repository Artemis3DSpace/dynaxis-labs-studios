/**
 * Dynaxis Design Components — client-safe exports.
 * Visual Composition Components (NOT React/npm/code components).
 */

export {
  componentDocumentSchema,
  componentPrimitiveLayerSchema,
  parseComponentDocument,
  collectComponentDocumentAssetIds,
  componentDocumentToCompositionDocument,
  DESIGN_COMPONENT_DOCUMENT_VERSION,
} from './document.js';

export {
  componentPropertyDefinitionSchema,
  componentOverrideSchema,
  componentOverridesSchema,
  COMPONENT_PROPERTY_TARGETS,
  validateComponentOverrides,
  evaluateComponentRevisionUpdate,
  bindTemplateSlotsToComponentOverrides,
} from './properties.js';

export {
  resolveComponentInstance,
  applyComponentOverrides,
  mapLayerToInstanceSpace,
  expandCompositionDocument,
} from './resolver.js';

export { expandForPreview } from './preview.js';

export {
  boundingBoxOfLayers,
  createComponentDocumentFromLayers,
  buildReplacementInstanceLayer,
} from './create-from-layers.js';

export {
  DESIGN_COMPONENT_CATEGORIES,
  DESIGN_COMPONENT_CATEGORY_META,
  isDesignComponentCategory,
  normalizeDesignComponentCategory,
} from './categories.js';
