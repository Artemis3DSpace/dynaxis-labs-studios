/**
 * Create Design Component Document from selected Composition layers (client-safe).
 */

import { parseComponentDocument } from './document.js';
import { DESIGN_COMPONENT_DOCUMENT_VERSION } from '../types.js';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
/**
 * Compute axis-aligned bounding box of layers.
 * @param {object[]} layers
 */
export function boundingBoxOfLayers(layers) {
  if (!layers?.length) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of layers) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.width);
    maxY = Math.max(maxY, l.y + l.height);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY)),
  };
}

/**
 * Normalize selected layers into Component-local coordinates.
 * Rejects component_instance layers (Phase 6H — no nested Components).
 *
 * @param {object[]} selectedLayers — text/image layers from Composition
 * @param {{ properties?: object[] }} [opts]
 */
export function createComponentDocumentFromLayers(selectedLayers, opts = {}) {
  const primitives = (selectedLayers || []).filter(
    (l) => l.type === 'text' || l.type === 'image'
  );
  if (!primitives.length) {
    const e = new Error('Select at least one text or image layer to create a Component');
    e.code = 'COMPONENT_NO_LAYERS';
    throw e;
  }
  if ((selectedLayers || []).some((l) => l.type === 'component_instance')) {
    const e = new Error('Cannot include Component Instances inside a Component (Phase 6H)');
    e.code = 'COMPONENT_NESTED_FORBIDDEN';
    throw e;
  }

  const box = boundingBoxOfLayers(primitives);
  const layers = primitives.map((l, i) => {
    const next = {
      ...l,
      id: l.id || newId(),
      x: l.x - box.x,
      y: l.y - box.y,
      zIndex: l.zIndex ?? i,
    };
    return next;
  });

  return parseComponentDocument({
    version: DESIGN_COMPONENT_DOCUMENT_VERSION,
    intrinsicWidth: Math.max(64, box.width),
    intrinsicHeight: Math.max(64, box.height),
    layers,
    properties: opts.properties || [],
    metadata: { sourceBoundingBox: box },
    hints: { fitModeDefault: 'proportional' },
  });
}

/**
 * Build a component_instance layer that visually replaces the selected layers.
 * @param {object} component — { id }
 * @param {object} revision — { id }
 * @param {ReturnType<typeof createComponentDocumentFromLayers>} componentDoc
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} zIndex
 */
export function buildReplacementInstanceLayer(component, revision, componentDoc, box, zIndex) {
  return {
    id: newId(),
    type: 'component_instance',
    name: 'Component Instance',
    componentId: component.id,
    componentRevisionId: revision.id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    zIndex,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    overrides: [],
    fitMode: 'proportional',
    adaptation: null,
  };
}
