/**
 * Dynaxis Design Operations — typed, validated Composition mutations (client-safe).
 * Design Agent reasons; these ops are the only write surface into Composition Documents.
 */

import { z } from 'zod';
import {
  COMPOSITION_DOCUMENT_VERSION,
  COMPOSITION_LAYER_ROLES,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
  DESIGN_TOKEN_BINDABLE_PROPERTIES,
} from '../types.js';
import {
  parseCompositionDocument,
  compositionLayerSchema,
  textLayerSchema,
  imageLayerSchema,
} from '../compositions/document.js';
import { clampLayerToCanvas, duplicateLayer } from '../compositions/layout.js';
import { normalizeHexColor } from '../compositions/colors.js';
import { componentOverridesSchema } from '../components/properties.js';
import { variantCombinationSchema } from '../component-sets/variants.js';
import { detachTokenBinding } from '../design-systems/bindings.js';

export const DESIGN_AGENT_MAX_OPERATIONS = 48;
export const DESIGN_AGENT_STALE_CODE = 'DESIGN_AGENT_STALE_COMPOSITION';

const uuid = z.string().uuid();
const hexColor = z
  .string()
  .trim()
  .refine((v) => normalizeHexColor(v) != null, 'invalid color');
const fontFamily = z
  .string()
  .trim()
  .max(120)
  .refine((v) => /^[a-zA-Z0-9 ,.'"\-]+$/.test(v), 'invalid font');
const tokenProperty = z.enum(DESIGN_TOKEN_BINDABLE_PROPERTIES);

const geometryPatch = z.object({
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional(),
  height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional(),
});

export const designOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('inspect_composition') }),
  z.object({ type: z.literal('inspect_canvas') }),
  z.object({ type: z.literal('list_layers') }),

  z.object({
    type: z.literal('add_text_layer'),
    text: z.string().max(8000),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    fontSize: z.number().positive().max(512).default(48),
    fontFamily: fontFamily.default('system-ui, sans-serif'),
    fontWeight: z.union([z.number().int().min(100).max(900), z.string().max(20)]).default(400),
    color: hexColor.default('#ffffff'),
    textAlign: z.enum(['left', 'center', 'right']).default('left'),
    role: z.enum(COMPOSITION_LAYER_ROLES).optional().nullable(),
    name: z.string().trim().max(120).optional().nullable(),
    zIndex: z.number().int().min(0).max(9999).optional(),
  }),

  z.object({
    type: z.literal('update_text'),
    layerId: uuid,
    text: z.string().max(8000),
  }),
  z.object({
    type: z.literal('set_font'),
    layerId: uuid,
    fontFamily,
  }),
  z.object({
    type: z.literal('set_font_size'),
    layerId: uuid,
    fontSize: z.number().positive().max(512),
  }),
  z.object({
    type: z.literal('set_font_weight'),
    layerId: uuid,
    fontWeight: z.union([z.number().int().min(100).max(900), z.string().max(20)]),
  }),
  z.object({
    type: z.literal('set_text_align'),
    layerId: uuid,
    textAlign: z.enum(['left', 'center', 'right']),
  }),
  z.object({
    type: z.literal('set_colour'),
    layerId: uuid,
    color: hexColor,
  }),
  z.object({
    type: z.literal('set_text_background'),
    layerId: uuid,
    backgroundColor: hexColor.nullable(),
  }),

  z.object({
    type: z.literal('add_image_layer'),
    assetId: uuid,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
    role: z.enum(COMPOSITION_LAYER_ROLES).optional().nullable(),
    name: z.string().trim().max(120).optional().nullable(),
    zIndex: z.number().int().min(0).max(9999).optional(),
  }),
  z.object({
    type: z.literal('replace_asset'),
    layerId: uuid,
    assetId: uuid,
  }),
  z.object({
    type: z.literal('set_image_fit'),
    layerId: uuid,
    fit: z.enum(['cover', 'contain', 'fill']),
  }),

  z.object({
    type: z.literal('move_layer'),
    layerId: uuid,
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  z.object({
    type: z.literal('resize_layer'),
    layerId: uuid,
    width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
  }),
  z.object({
    type: z.literal('set_opacity'),
    layerId: uuid,
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal('set_rotation'),
    layerId: uuid,
    rotation: z.number().finite().min(-360).max(360),
  }),
  z.object({
    type: z.literal('reorder_layer'),
    layerId: uuid,
    zIndex: z.number().int().min(0).max(9999),
  }),
  z.object({
    type: z.literal('set_visibility'),
    layerId: uuid,
    visible: z.boolean(),
  }),
  z.object({
    type: z.literal('set_locked'),
    layerId: uuid,
    locked: z.boolean(),
  }),
  z.object({
    type: z.literal('duplicate_layer'),
    layerId: uuid,
  }),
  z.object({
    type: z.literal('delete_layer'),
    layerId: uuid,
  }),

  z.object({
    type: z.literal('set_canvas_background_colour'),
    color: hexColor.nullable(),
  }),
  z.object({
    type: z.literal('set_background_asset'),
    assetId: uuid,
    fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  }),
  z.object({
    type: z.literal('set_background_colour'),
    color: hexColor,
  }),

  /** Phase 6H — Component Instance ops (IDs must come from controlled discovery). */
  z.object({
    type: z.literal('insert_component_instance'),
    componentId: uuid,
    componentRevisionId: uuid,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    overrides: componentOverridesSchema.optional(),
    name: z.string().trim().max(120).optional().nullable(),
    fitMode: z.enum(['proportional', 'stretch']).default('proportional'),
    zIndex: z.number().int().min(0).max(9999).optional(),
  }),
  z.object({
    type: z.literal('update_component_instance_overrides'),
    layerId: uuid,
    overrides: componentOverridesSchema,
  }),
  z.object({
    type: z.literal('update_component_instance_revision'),
    layerId: uuid,
    currentRevisionId: uuid,
    targetRevisionId: uuid,
    /** Compatible overrides to keep after explicit update. */
    overrides: componentOverridesSchema.optional(),
  }),
  z.object({
    type: z.literal('detach_component_instance'),
    layerId: uuid,
    /** Server-expanded ordinary layers that replace the instance. */
    expandedLayers: z.array(compositionLayerSchema).min(1).max(48),
  }),

  /** Phase 6I — Design Tokens / Modes / Component Set variants (IDs from discovery). */
  z.object({
    type: z.literal('bind_token'),
    layerId: uuid,
    property: tokenProperty,
    tokenId: uuid,
  }),
  z.object({
    type: z.literal('detach_token'),
    layerId: uuid,
    property: tokenProperty,
  }),
  z.object({
    type: z.literal('switch_design_mode'),
    collectionId: uuid,
    modeId: uuid,
  }),
  z.object({
    type: z.literal('switch_component_variant'),
    layerId: uuid,
    combination: variantCombinationSchema,
    /** Server may fill after resolving the Component Set variant. */
    componentId: uuid.optional(),
    componentRevisionId: uuid.optional(),
    overrides: componentOverridesSchema.optional(),
  }),
  z.object({
    type: z.literal('insert_component_set_instance'),
    componentSetId: uuid,
    combination: variantCombinationSchema.optional().nullable(),
    /** Server may fill after resolving the Component Set variant. */
    componentId: uuid.optional(),
    componentRevisionId: uuid.optional(),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
    overrides: componentOverridesSchema.optional(),
    name: z.string().trim().max(120).optional().nullable(),
    fitMode: z.enum(['proportional', 'stretch']).default('proportional'),
    zIndex: z.number().int().min(0).max(9999).optional(),
  }),
]);

export const designOperationBatchSchema = z.object({
  compositionId: uuid,
  documentVersion: z.number().int().positive(),
  operations: z.array(designOperationSchema).min(1).max(DESIGN_AGENT_MAX_OPERATIONS),
  summary: z.string().trim().max(500).optional().nullable(),
});

export const designActionPlanSchema = z.object({
  summary: z.string().trim().max(800),
  intent: z.string().trim().max(800).optional().nullable(),
  operations: z.array(designOperationSchema).min(0).max(DESIGN_AGENT_MAX_OPERATIONS),
  warnings: z.array(z.string().max(300)).max(24).optional().nullable(),
  assumptions: z.array(z.string().max(300)).max(24).optional().nullable(),
});

/**
 * @param {unknown} input
 */
export function parseDesignOperationBatch(input) {
  return designOperationBatchSchema.parse(input);
}

/**
 * @param {unknown} input
 */
export function parseDesignActionPlan(input) {
  return designActionPlanSchema.parse(input);
}

function newLayerId(idFn) {
  if (typeof idFn === 'function') return idFn();
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `00000000-0000-4000-8000-${String(Date.now()).padStart(12, '0').slice(-12)}`;
}

function findLayer(layers, layerId) {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx < 0) {
    const err = new Error(`Layer not found: ${layerId}`);
    err.code = 'DESIGN_LAYER_NOT_FOUND';
    throw err;
  }
  return { layer: layers[idx], idx };
}

function requireEditable(layer, opType) {
  if (layer.locked && opType !== 'set_locked') {
    const err = new Error(`Layer is locked: ${layer.id}`);
    err.code = 'DESIGN_LAYER_LOCKED';
    throw err;
  }
}

function requireText(layer) {
  if (layer.type !== 'text') {
    const err = new Error(`Operation requires text layer: ${layer.id}`);
    err.code = 'DESIGN_LAYER_TYPE_MISMATCH';
    throw err;
  }
}

function requireImage(layer) {
  if (layer.type !== 'image') {
    const err = new Error(`Operation requires image layer: ${layer.id}`);
    err.code = 'DESIGN_LAYER_TYPE_MISMATCH';
    throw err;
  }
}

function nextZIndex(layers) {
  return layers.reduce((m, l) => Math.max(m, l.zIndex || 0), 0) + 1;
}

/**
 * Pure deterministic application of Design Operations to a Composition Document.
 * @param {unknown} documentInput
 * @param {unknown[]} operationsInput
 * @param {{ idFn?: () => string, allowedAssetIds?: Set<string>|null }} [opts]
 * @returns {{ document: object, inspections: object[], createdLayerIds: string[] }}
 */
export function applyDesignOperations(documentInput, operationsInput, opts = {}) {
  if (!Array.isArray(operationsInput) || operationsInput.length === 0) {
    const err = new Error('At least one operation required');
    err.code = 'DESIGN_OPS_EMPTY';
    throw err;
  }
  if (operationsInput.length > DESIGN_AGENT_MAX_OPERATIONS) {
    const err = new Error(`Too many operations (max ${DESIGN_AGENT_MAX_OPERATIONS})`);
    err.code = 'DESIGN_OPS_TOO_MANY';
    throw err;
  }

  const operations = operationsInput.map((op) => designOperationSchema.parse(op));
  let doc = parseCompositionDocument(documentInput);
  const layers = doc.layers.map((l) => ({ ...l }));
  let background = { ...doc.background };
  let canvas = { ...doc.canvas };
  const inspections = [];
  const createdLayerIds = [];
  const allowed = opts.allowedAssetIds || null;
  const allowedComponents = opts.allowedComponentIds || null;
  const allowedComponentRevisions = opts.allowedComponentRevisionIds || null;
  const allowedTokens = opts.allowedTokenIds || null;
  const allowedComponentSets = opts.allowedComponentSetIds || null;
  const allowedModes = opts.allowedModeIds || null;
  let designSystem = doc.designSystem ? { ...doc.designSystem, modes: { ...(doc.designSystem.modes || {}) } } : null;

  function assertAsset(assetId) {
    if (allowed && !allowed.has(assetId)) {
      const err = new Error(`Asset not in approved discovery set: ${assetId}`);
      err.code = 'DESIGN_ASSET_NOT_APPROVED';
      throw err;
    }
  }

  function assertComponent(componentId, revisionId) {
    if (allowedComponents && !allowedComponents.has(componentId)) {
      const err = new Error(`Component not in approved discovery set: ${componentId}`);
      err.code = 'DESIGN_COMPONENT_NOT_APPROVED';
      throw err;
    }
    if (allowedComponentRevisions && revisionId && !allowedComponentRevisions.has(revisionId)) {
      const err = new Error(`Component revision not in approved discovery set: ${revisionId}`);
      err.code = 'DESIGN_COMPONENT_REVISION_NOT_APPROVED';
      throw err;
    }
  }

  function assertToken(tokenId) {
    if (allowedTokens && !allowedTokens.has(tokenId)) {
      const err = new Error(`Token not in approved discovery set: ${tokenId}`);
      err.code = 'DESIGN_TOKEN_NOT_APPROVED';
      throw err;
    }
  }

  function assertComponentSet(componentSetId) {
    if (allowedComponentSets && !allowedComponentSets.has(componentSetId)) {
      const err = new Error(`Component Set not in approved discovery set: ${componentSetId}`);
      err.code = 'DESIGN_COMPONENT_SET_NOT_APPROVED';
      throw err;
    }
  }

  function assertMode(modeId) {
    if (allowedModes && !allowedModes.has(modeId)) {
      const err = new Error(`Mode not in approved discovery set: ${modeId}`);
      err.code = 'DESIGN_MODE_NOT_APPROVED';
      throw err;
    }
  }

  function requireComponentInstance(layer) {
    if (layer.type !== 'component_instance') {
      const err = new Error(`Operation requires component_instance layer: ${layer.id}`);
      err.code = 'DESIGN_LAYER_TYPE_MISMATCH';
      throw err;
    }
  }

  for (const op of operations) {
    switch (op.type) {
      case 'inspect_composition':
        inspections.push({
          type: 'composition',
          canvas: { width: canvas.width, height: canvas.height },
          layerCount: layers.length,
          backgroundKind: background.kind,
        });
        break;
      case 'inspect_canvas':
        inspections.push({ type: 'canvas', canvas, background });
        break;
      case 'list_layers':
        inspections.push({
          type: 'layers',
          layers: layers.map((l) => ({
            id: l.id,
            type: l.type,
            role: l.role,
            name: l.name,
            locked: l.locked,
            visible: l.visible,
            zIndex: l.zIndex,
            ...(l.type === 'component_instance'
              ? {
                  componentId: l.componentId,
                  componentRevisionId: l.componentRevisionId,
                }
              : {}),
          })),
        });
        break;

      case 'add_text_layer': {
        if (layers.length >= 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        const id = newLayerId(opts.idFn);
        const box = clampLayerToCanvas(
          { x: op.x, y: op.y, width: op.width, height: op.height },
          canvas
        );
        const layer = textLayerSchema.parse({
          id,
          type: 'text',
          text: op.text,
          ...box,
          fontSize: op.fontSize,
          fontFamily: op.fontFamily,
          fontWeight: op.fontWeight,
          color: op.color,
          textAlign: op.textAlign,
          role: op.role ?? 'custom',
          name: op.name ?? 'Text',
          zIndex: op.zIndex ?? nextZIndex(layers),
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
        });
        layers.push(layer);
        createdLayerIds.push(id);
        break;
      }

      case 'update_text': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, text: op.text };
        break;
      }
      case 'set_font': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, fontFamily: op.fontFamily };
        break;
      }
      case 'set_font_size': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, fontSize: op.fontSize };
        break;
      }
      case 'set_font_weight': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, fontWeight: op.fontWeight };
        break;
      }
      case 'set_text_align': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, textAlign: op.textAlign };
        break;
      }
      case 'set_colour': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = { ...layer, color: normalizeHexColor(op.color) };
        break;
      }
      case 'set_text_background': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireText(layer);
        layers[idx] = {
          ...layer,
          backgroundColor: op.backgroundColor ? normalizeHexColor(op.backgroundColor) : null,
        };
        break;
      }

      case 'add_image_layer': {
        if (layers.length >= 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        assertAsset(op.assetId);
        const id = newLayerId(opts.idFn);
        const box = clampLayerToCanvas(
          { x: op.x, y: op.y, width: op.width, height: op.height },
          canvas
        );
        const layer = imageLayerSchema.parse({
          id,
          type: 'image',
          assetId: op.assetId,
          ...box,
          fit: op.fit,
          role: op.role ?? 'custom',
          name: op.name ?? 'Image',
          zIndex: op.zIndex ?? nextZIndex(layers),
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
        });
        layers.push(layer);
        createdLayerIds.push(id);
        break;
      }
      case 'replace_asset': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireImage(layer);
        assertAsset(op.assetId);
        layers[idx] = { ...layer, assetId: op.assetId };
        break;
      }
      case 'set_image_fit': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireImage(layer);
        layers[idx] = { ...layer, fit: op.fit };
        break;
      }

      case 'move_layer': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        const box = clampLayerToCanvas(
          { x: op.x, y: op.y, width: layer.width, height: layer.height },
          canvas
        );
        layers[idx] = { ...layer, x: box.x, y: box.y };
        break;
      }
      case 'resize_layer': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        const box = clampLayerToCanvas(
          { x: layer.x, y: layer.y, width: op.width, height: op.height },
          canvas
        );
        layers[idx] = { ...layer, ...box };
        break;
      }
      case 'set_opacity': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        layers[idx] = { ...layer, opacity: op.opacity };
        break;
      }
      case 'set_rotation': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        layers[idx] = { ...layer, rotation: op.rotation };
        break;
      }
      case 'reorder_layer': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        layers[idx] = { ...layer, zIndex: op.zIndex };
        break;
      }
      case 'set_visibility': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        layers[idx] = { ...layer, visible: op.visible };
        break;
      }
      case 'set_locked': {
        const { layer, idx } = findLayer(layers, op.layerId);
        layers[idx] = { ...layer, locked: op.locked };
        break;
      }
      case 'duplicate_layer': {
        if (layers.length >= 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        const { layer } = findLayer(layers, op.layerId);
        const copy = duplicateLayer(layer, () => newLayerId(opts.idFn));
        const boxed = clampLayerToCanvas(
          { x: copy.x + 16, y: copy.y + 16, width: copy.width, height: copy.height },
          canvas
        );
        const next = { ...copy, ...boxed, zIndex: nextZIndex(layers), locked: false };
        compositionLayerSchema.parse(next);
        layers.push(next);
        createdLayerIds.push(next.id);
        break;
      }
      case 'delete_layer': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        layers.splice(idx, 1);
        break;
      }

      case 'set_canvas_background_colour':
        canvas = {
          ...canvas,
          backgroundColor: op.color ? normalizeHexColor(op.color) : null,
        };
        break;
      case 'set_background_asset':
        assertAsset(op.assetId);
        background = {
          kind: 'asset',
          assetId: op.assetId,
          fit: op.fit,
          position: background.position || 'middle-center',
          opacity: background.opacity ?? 1,
          color: null,
        };
        break;
      case 'set_background_colour':
        background = {
          kind: 'color',
          color: normalizeHexColor(op.color),
          fit: 'cover',
          position: 'middle-center',
          opacity: 1,
          assetId: null,
        };
        break;

      case 'insert_component_instance': {
        if (layers.length >= 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        assertComponent(op.componentId, op.componentRevisionId);
        for (const ov of op.overrides || []) {
          if (ov.type === 'asset') assertAsset(ov.value);
        }
        const id = newLayerId(opts.idFn);
        const box = clampLayerToCanvas(
          { x: op.x, y: op.y, width: op.width, height: op.height },
          canvas
        );
        const layer = compositionLayerSchema.parse({
          id,
          type: 'component_instance',
          name: op.name ?? 'Component',
          componentId: op.componentId,
          componentRevisionId: op.componentRevisionId,
          ...box,
          zIndex: op.zIndex ?? nextZIndex(layers),
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          overrides: op.overrides || [],
          fitMode: op.fitMode || 'proportional',
          adaptation: {
            preserveAspectRatio: true,
            scaleBehaviour: 'proportional',
            semanticPriority: 'primary',
          },
        });
        layers.push(layer);
        createdLayerIds.push(id);
        break;
      }

      case 'update_component_instance_overrides': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireComponentInstance(layer);
        for (const ov of op.overrides || []) {
          if (ov.type === 'asset') assertAsset(ov.value);
        }
        layers[idx] = { ...layer, overrides: op.overrides || [] };
        break;
      }

      case 'update_component_instance_revision': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireComponentInstance(layer);
        if (layer.componentRevisionId !== op.currentRevisionId) {
          const err = new Error('Instance is not pinned to the expected current revision');
          err.code = 'COMPONENT_REVISION_MISMATCH';
          throw err;
        }
        assertComponent(layer.componentId, op.targetRevisionId);
        layers[idx] = {
          ...layer,
          componentRevisionId: op.targetRevisionId,
          overrides: op.overrides ?? layer.overrides,
        };
        break;
      }

      case 'detach_component_instance': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireComponentInstance(layer);
        if (layers.length - 1 + op.expandedLayers.length > 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        for (const el of op.expandedLayers) {
          if (el.type === 'component_instance') {
            const err = new Error('Detached layers must not include component_instance');
            err.code = 'COMPONENT_NESTED_FORBIDDEN';
            throw err;
          }
          if (el.type === 'image') assertAsset(el.assetId);
        }
        layers.splice(idx, 1, ...op.expandedLayers.map((l) => ({ ...l })));
        break;
      }

      case 'bind_token': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        assertToken(op.tokenId);
        layers[idx] = {
          ...layer,
          tokenBindings: {
            ...(layer.tokenBindings || {}),
            [op.property]: { tokenId: op.tokenId },
          },
        };
        break;
      }

      case 'detach_token': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        const { target } = detachTokenBinding(layer, op.property, null, {});
        layers[idx] = target;
        break;
      }

      case 'switch_design_mode': {
        assertMode(op.modeId);
        designSystem = {
          ...(designSystem || {}),
          modes: {
            ...((designSystem && designSystem.modes) || {}),
            [op.collectionId]: op.modeId,
          },
        };
        break;
      }

      case 'switch_component_variant': {
        const { layer, idx } = findLayer(layers, op.layerId);
        requireEditable(layer, op.type);
        requireComponentInstance(layer);
        if (!layer.componentSetId) {
          const err = new Error('Instance is not linked to a Component Set');
          err.code = 'COMPONENT_SET_REQUIRED';
          throw err;
        }
        assertComponentSet(layer.componentSetId);
        if (!op.componentId || !op.componentRevisionId) {
          const err = new Error('Variant resolution incomplete — server must fill component revision');
          err.code = 'COMPONENT_VARIANT_UNRESOLVED';
          throw err;
        }
        assertComponent(op.componentId, op.componentRevisionId);
        layers[idx] = {
          ...layer,
          componentId: op.componentId,
          componentRevisionId: op.componentRevisionId,
          variantProperties: op.combination,
          overrides: op.overrides ?? layer.overrides,
        };
        break;
      }

      case 'insert_component_set_instance': {
        if (layers.length >= 64) {
          const err = new Error('Maximum layer count reached');
          err.code = 'DESIGN_LAYER_LIMIT';
          throw err;
        }
        assertComponentSet(op.componentSetId);
        if (!op.componentId || !op.componentRevisionId || !op.combination) {
          const err = new Error('Component Set instance resolution incomplete');
          err.code = 'COMPONENT_VARIANT_UNRESOLVED';
          throw err;
        }
        assertComponent(op.componentId, op.componentRevisionId);
        for (const ov of op.overrides || []) {
          if (ov.type === 'asset') assertAsset(ov.value);
        }
        const id = newLayerId(opts.idFn);
        const box = clampLayerToCanvas(
          { x: op.x, y: op.y, width: op.width, height: op.height },
          canvas
        );
        const layer = compositionLayerSchema.parse({
          id,
          type: 'component_instance',
          name: op.name ?? 'Component Set',
          componentId: op.componentId,
          componentRevisionId: op.componentRevisionId,
          componentSetId: op.componentSetId,
          variantProperties: op.combination,
          ...box,
          zIndex: op.zIndex ?? nextZIndex(layers),
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          overrides: op.overrides || [],
          fitMode: op.fitMode || 'proportional',
          adaptation: {
            preserveAspectRatio: true,
            scaleBehaviour: 'proportional',
            semanticPriority: 'primary',
          },
        });
        layers.push(layer);
        createdLayerIds.push(id);
        break;
      }

      default: {
        const err = new Error(`Unknown operation: ${op.type}`);
        err.code = 'DESIGN_OP_UNKNOWN';
        throw err;
      }
    }
  }

  if (
    canvas.width < COMPOSITION_MIN_CANVAS_PX ||
    canvas.height < COMPOSITION_MIN_CANVAS_PX ||
    canvas.width > COMPOSITION_MAX_CANVAS_PX ||
    canvas.height > COMPOSITION_MAX_CANVAS_PX
  ) {
    const err = new Error('Canvas dimensions out of range');
    err.code = 'DESIGN_CANVAS_INVALID';
    throw err;
  }

  const document = parseCompositionDocument({
    version: COMPOSITION_DOCUMENT_VERSION,
    canvas,
    background,
    layers,
    guides: doc.guides ?? null,
    editorPrefs: doc.editorPrefs ?? null,
    designSystem,
  });

  return { document, inspections, createdLayerIds };
}

/**
 * Try to extract a Design Action Plan from LLM text (JSON object or fenced block).
 * @param {string} text
 */
export function extractDesignActionPlanFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    const err = new Error('Empty LLM response');
    err.code = 'DESIGN_PLAN_EMPTY';
    throw err;
  }
  let jsonText = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonText = fence[1].trim();
  else {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) jsonText = raw.slice(start, end + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const err = new Error('LLM response is not valid JSON Design Action Plan');
    err.code = 'DESIGN_PLAN_INVALID_JSON';
    throw err;
  }
  return parseDesignActionPlan(parsed);
}
