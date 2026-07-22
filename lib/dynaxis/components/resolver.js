/**
 * Resolve a Component Instance into expanded Composition layers (client-safe).
 *
 * Shared by Creative Editor preview, Design Agent inspection, SVG renderer, adaptation.
 * Database access stays outside this function.
 */

import { parseComponentDocument } from './document.js';
import { validateComponentOverrides } from './properties.js';
import { normalizeHexColor } from '../compositions/colors.js';
import { applyTokenBindingsToDocument } from '../design-systems/bindings.js';

function newLayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @typedef {object} ComponentInstancePlacement
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} [rotation]
 * @property {number} [opacity]
 * @property {boolean} [visible]
 * @property {'proportional'|'stretch'} [fitMode]
 */

/**
 * Apply property overrides onto a deep-cloned Component Document's layers.
 * @param {import('zod').infer<typeof import('./document.js').componentDocumentSchema>} componentDoc
 * @param {import('zod').infer<typeof import('./properties.js').componentOverrideSchema>[]} overrides
 */
export function applyComponentOverrides(componentDoc, overrides) {
  const doc = structuredClone
    ? structuredClone(componentDoc)
    : JSON.parse(JSON.stringify(componentDoc));
  const defById = new Map(doc.properties.map((p) => [p.id, p]));

  for (const ov of overrides || []) {
    const def = defById.get(ov.propertyId);
    if (!def) continue;
    const layer = doc.layers.find((l) => l.id === def.targetLayerId);
    if (!layer) continue;

    if (def.type === 'text' && def.targetProperty === 'text' && layer.type === 'text') {
      layer.text = String(ov.value);
    } else if (def.type === 'asset' && def.targetProperty === 'assetId' && layer.type === 'image') {
      layer.assetId = String(ov.value);
    } else if (def.type === 'colour' && layer.type === 'text') {
      const color = normalizeHexColor(String(ov.value));
      if (color && (def.targetProperty === 'color' || def.targetProperty === 'backgroundColor')) {
        layer[def.targetProperty] = color;
      }
    } else if (def.type === 'visibility' && def.targetProperty === 'visible') {
      layer.visible = Boolean(ov.value);
    }
  }

  // Apply defaults for properties without overrides
  const overridden = new Set((overrides || []).map((o) => o.propertyId));
  for (const def of doc.properties) {
    if (overridden.has(def.id) || def.defaultValue == null) continue;
    const layer = doc.layers.find((l) => l.id === def.targetLayerId);
    if (!layer) continue;
    if (def.type === 'text' && layer.type === 'text') layer.text = String(def.defaultValue);
    if (def.type === 'asset' && layer.type === 'image') layer.assetId = String(def.defaultValue);
    if (def.type === 'colour' && layer.type === 'text') {
      const color = normalizeHexColor(String(def.defaultValue));
      if (color) layer[def.targetProperty] = color;
    }
    if (def.type === 'visibility') layer.visible = Boolean(def.defaultValue);
  }

  return doc;
}

/**
 * Scale + translate a layer from intrinsic Component space into instance placement.
 * @param {object} layer
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} instanceOpacity
 * @param {string} [idPrefix]
 */
export function mapLayerToInstanceSpace(layer, scaleX, scaleY, offsetX, offsetY, instanceOpacity, idPrefix) {
  const mapped = {
    ...layer,
    // Render/export requires UUID layer ids — never emit "instance:child" composites.
    id: newLayerId(),
    name: idPrefix ? `${idPrefix}:${layer.name || layer.id}` : layer.name,
    x: offsetX + layer.x * scaleX,
    y: offsetY + layer.y * scaleY,
    width: Math.max(1, layer.width * scaleX),
    height: Math.max(1, layer.height * scaleY),
    opacity: (layer.opacity ?? 1) * (instanceOpacity ?? 1),
  };
  if (layer.type === 'text') {
    mapped.fontSize = Math.max(1, (layer.fontSize || 16) * Math.min(scaleX, scaleY));
    mapped.padding = (layer.padding || 0) * Math.min(scaleX, scaleY);
    mapped.letterSpacing = (layer.letterSpacing || 0) * Math.min(scaleX, scaleY);
    mapped.borderRadius = (layer.borderRadius || 0) * Math.min(scaleX, scaleY);
  }
  return mapped;
}

/**
 * Resolve a Component Instance into expanded renderable child layers.
 *
 * @param {unknown} componentRevisionDocument — Component Document from pinned revision
 * @param {unknown} overridesInput
 * @param {ComponentInstancePlacement} placement
 * @param {{
 *   instanceLayerId?: string,
 *   rejectInvalidOverrides?: boolean,
 *   tokenDocument?: unknown,
 *   modesByCollection?: Record<string, string>,
 * }} [opts]
 */
export function resolveComponentInstance(componentRevisionDocument, overridesInput, placement, opts = {}) {
  let componentDoc = parseComponentDocument(componentRevisionDocument);

  // Token bindings first; overrides win for the same property.
  if (opts.tokenDocument) {
    const { document: tokenApplied } = applyTokenBindingsToDocument(
      {
        version: 1,
        canvas: {
          width: componentDoc.intrinsicWidth,
          height: componentDoc.intrinsicHeight,
        },
        background: { kind: 'color', color: '#000000' },
        layers: componentDoc.layers,
      },
      opts.tokenDocument,
      {
        modesByCollection: opts.modesByCollection || {},
        rejectUnresolved: Boolean(opts.rejectUnresolvedTokens),
      }
    );
    componentDoc = {
      ...componentDoc,
      layers: tokenApplied.layers,
    };
  }

  const { overrides, errors } = validateComponentOverrides(componentDoc.properties, overridesInput);

  if (opts.rejectInvalidOverrides && errors.length) {
    const e = new Error(errors[0].message || 'invalid component overrides');
    e.code = errors[0].code || 'COMPONENT_OVERRIDE_INVALID';
    e.errors = errors;
    throw e;
  }

  const applied = applyComponentOverrides(componentDoc, overrides);
  const fitMode = placement.fitMode || componentDoc.hints?.fitModeDefault || 'proportional';

  let scaleX = placement.width / componentDoc.intrinsicWidth;
  let scaleY = placement.height / componentDoc.intrinsicHeight;
  if (fitMode === 'proportional') {
    const s = Math.min(scaleX, scaleY);
    scaleX = s;
    scaleY = s;
  }

  // Centre content when proportional leaves unused space
  const contentW = componentDoc.intrinsicWidth * scaleX;
  const contentH = componentDoc.intrinsicHeight * scaleY;
  const padX = fitMode === 'proportional' ? (placement.width - contentW) / 2 : 0;
  const padY = fitMode === 'proportional' ? (placement.height - contentH) / 2 : 0;

  const offsetX = placement.x + padX;
  const offsetY = placement.y + padY;
  const prefix = opts.instanceLayerId || undefined;
  const instanceOpacity = placement.visible === false ? 0 : (placement.opacity ?? 1);

  const layers = applied.layers
    .filter((l) => l.visible !== false)
    .map((layer) =>
      mapLayerToInstanceSpace(layer, scaleX, scaleY, offsetX, offsetY, instanceOpacity, prefix)
    );

  // Instance-level rotation: bake into a group transform conceptually by adjusting
  // child positions around instance centre when rotation is non-zero.
  const rotation = placement.rotation || 0;
  if (rotation !== 0) {
    const cx = placement.x + placement.width / 2;
    const cy = placement.y + placement.height / 2;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (const layer of layers) {
      const lx = layer.x + layer.width / 2 - cx;
      const ly = layer.y + layer.height / 2 - cy;
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      layer.x = cx + rx - layer.width / 2;
      layer.y = cy + ry - layer.height / 2;
      layer.rotation = (layer.rotation || 0) + rotation;
    }
  }

  return {
    layers,
    scaleX,
    scaleY,
    intrinsicWidth: componentDoc.intrinsicWidth,
    intrinsicHeight: componentDoc.intrinsicHeight,
    errors,
    overrides,
    document: applied,
  };
}

/**
 * Expand all component_instance layers in a Composition Document to text/image layers.
 * @param {object} compositionDoc — parsed or raw Composition Document
 * @param {(componentRevisionId: string) => object | null | Promise<object|null>} getRevisionDocument
 *   Returns Component Document (or full revision with .document). Sync or async.
 * @param {{
 *   tokenDocument?: unknown,
 *   modesByCollection?: Record<string, string>,
 *   rejectUnresolvedTokens?: boolean,
 * }} [opts]
 */
export async function expandCompositionDocument(compositionDoc, getRevisionDocument, opts = {}) {
  const layers = [];
  const errors = [];
  let zBase = 0;

  for (const layer of compositionDoc.layers || []) {
    if (layer.type !== 'component_instance') {
      layers.push({ ...layer, zIndex: layer.zIndex ?? zBase++ });
      continue;
    }

    if (layer.visible === false) continue;

    const rev = await getRevisionDocument(layer.componentRevisionId);
    if (!rev) {
      errors.push({
        code: 'COMPONENT_REVISION_UNAVAILABLE',
        message: `Component revision unavailable: ${layer.componentRevisionId}`,
        layerId: layer.id,
        componentId: layer.componentId,
        componentRevisionId: layer.componentRevisionId,
      });
      continue;
    }

    const componentDocument = rev.document ?? rev;
    try {
      const resolved = resolveComponentInstance(
        componentDocument,
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
        {
          instanceLayerId: layer.id,
          tokenDocument: opts.tokenDocument || null,
          modesByCollection: opts.modesByCollection || {},
          rejectUnresolvedTokens: opts.rejectUnresolvedTokens,
        }
      );
      for (const child of resolved.layers) {
        layers.push({
          ...child,
          zIndex: (layer.zIndex ?? 0) * 1000 + (child.zIndex ?? 0),
          locked: layer.locked || child.locked,
        });
      }
      if (resolved.errors?.length) {
        errors.push(
          ...resolved.errors.map((e) => ({
            ...e,
            layerId: layer.id,
          }))
        );
      }
    } catch (err) {
      errors.push({
        code: err.code || 'COMPONENT_RESOLVE_FAILED',
        message: err.message || 'failed to resolve component instance',
        layerId: layer.id,
      });
    }
  }

  return {
    document: {
      ...compositionDoc,
      layers,
    },
    errors,
  };
}
