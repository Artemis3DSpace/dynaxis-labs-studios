/**
 * Sync preview expansion for Composition Documents containing Component Instances.
 * Client-safe — no DB access; caller supplies revision documents.
 */

import { resolveComponentInstance } from './resolver.js';

/**
 * Expand component_instance layers for editor/preview display.
 *
 * @param {object} compositionDoc
 * @param {Record<string, object>|Map<string, object>} revisionDocumentsById
 *   Maps componentRevisionId → Component Document (or { document })
 * @returns {{ document: object, errors: object[] }}
 */
export function expandForPreview(compositionDoc, revisionDocumentsById = {}) {
  const layers = [];
  const errors = [];

  function getDoc(revisionId) {
    if (!revisionDocumentsById) return null;
    if (typeof revisionDocumentsById.get === 'function') {
      return revisionDocumentsById.get(revisionId) || null;
    }
    return revisionDocumentsById[revisionId] || null;
  }

  for (const layer of compositionDoc?.layers || []) {
    if (layer.type !== 'component_instance') {
      layers.push(layer);
      continue;
    }
    if (layer.visible === false) continue;

    const rev = getDoc(layer.componentRevisionId);
    if (!rev) {
      errors.push({
        code: 'COMPONENT_REVISION_UNAVAILABLE',
        message: `Component revision unavailable: ${layer.componentRevisionId}`,
        layerId: layer.id,
      });
      layers.push(layer);
      continue;
    }

    try {
      const resolved = resolveComponentInstance(
        rev.document ?? rev,
        layer.overrides || [],
        {
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          rotation: layer.rotation,
          opacity: layer.opacity,
          visible: layer.visible,
          fitMode: layer.fitMode || 'proportional',
        },
        { instanceLayerId: layer.id }
      );
      for (const child of resolved.layers) {
        layers.push({
          ...child,
          zIndex: (layer.zIndex ?? 0) * 1000 + (child.zIndex ?? 0),
          locked: layer.locked || child.locked,
        });
      }
      if (resolved.errors?.length) {
        errors.push(...resolved.errors.map((e) => ({ ...e, layerId: layer.id })));
      }
    } catch (err) {
      errors.push({
        code: err.code || 'COMPONENT_RESOLVE_FAILED',
        message: err.message || 'failed to resolve',
        layerId: layer.id,
      });
      layers.push(layer);
    }
  }

  return {
    document: { ...compositionDoc, layers },
    errors,
  };
}
