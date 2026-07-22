/**
 * Dynaxis Design Systems — client-safe exports.
 */

export {
  designTokenDocumentSchema,
  designTokenSchema,
  designTokenCollectionSchema,
  designTokenModeSchema,
  parseDesignTokenDocument,
  emptyDesignTokenDocument,
  DESIGN_TOKEN_DOCUMENT_VERSION,
  DESIGN_TOKEN_PRIMITIVE_TYPES,
} from './document.js';

export {
  resolveDesignToken,
  resolveDesignTokens,
  evaluateDesignSystemRevisionUpdate,
} from './resolver.js';

export {
  tokenBindingRefSchema,
  tokenBindingsSchema,
  designSystemContextSchema,
  TOKEN_BINDING_EXPECTED_TYPE,
  collectDocumentTokenIds,
  applyTokenBindingsToDocument,
  detachTokenBinding,
} from './bindings.js';

export { seedTokenDocumentFromBrandVisual } from './seed-from-brand.js';
