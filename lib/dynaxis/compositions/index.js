/**
 * Dynaxis Composition — client-safe exports.
 */

export {
  compositionDocumentSchema,
  textLayerSchema,
  imageLayerSchema,
  backgroundSchema,
  canvasSchema,
  compositionLayerSchema,
  POSITION_PRESETS,
  parseCompositionDocument,
  collectDocumentAssetIds,
} from './document.js';
export {
  normalizeHexColor,
  safeCssColor,
} from './colors.js';
export {
  positionFromPreset,
  clampLayerToCanvas,
  nudgeLayer,
  sortLayersForRender,
  escapeSvgText,
  textAnchorForAlign,
  textXForAlign,
  duplicateLayer,
} from './layout.js';
export {
  buildInitialDeliverableDocument,
  buildInitialAssetDocument,
  canvasDimensionsFromAspect,
} from './initial-layout.js';
export {
  createUndoState,
  pushUndo,
  undo,
  redo,
  canUndo,
  canRedo,
} from './undo.js';
export { compositionBrandHints } from './consumer.js';
