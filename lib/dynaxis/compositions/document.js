/**
 * Dynaxis Composition Document — versioned Zod schema (client-safe).
 */

import { z } from 'zod';
import {
  COMPOSITION_DOCUMENT_VERSION,
  COMPOSITION_LAYER_ROLES,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
} from '../types.js';
import { normalizeHexColor } from './colors.js';
import { componentOverridesSchema } from '../components/properties.js';
import { tokenBindingsSchema, designSystemContextSchema } from '../design-systems/bindings.js';
import { variantCombinationSchema } from '../component-sets/variants.js';

export const POSITION_PRESETS = /** @type {const} */ ([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);

const hexColorSchema = z
  .string()
  .trim()
  .refine((v) => !v || normalizeHexColor(v) != null, 'invalid color');

const fontFamilySchema = z
  .string()
  .trim()
  .max(120)
  .refine(
    (v) => /^[a-zA-Z0-9 ,.'"\-]+$/.test(v),
    'font-family contains invalid characters'
  );

/** Optional Phase 6F adaptation hints — backward-compatible defaults when absent. */
export const adaptationHintsSchema = z
  .object({
    horizontalAnchor: z.enum(['left', 'centre', 'right']).optional().nullable(),
    verticalAnchor: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
    scaleBehaviour: z.enum(['fixed', 'proportional']).optional().nullable(),
    minWidth: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional().nullable(),
    minHeight: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional().nullable(),
    maxWidth: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional().nullable(),
    maxHeight: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX).optional().nullable(),
    preserveAspectRatio: z.boolean().optional().nullable(),
    safeAreaPreference: z.enum(['ignore', 'prefer', 'require']).optional().nullable(),
    semanticPriority: z
      .enum(['critical', 'primary', 'secondary', 'decorative'])
      .optional()
      .nullable(),
  })
  .optional()
  .nullable();

const baseLayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(120).optional().nullable(),
  role: z.enum(COMPOSITION_LAYER_ROLES).optional().nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
  height: z.number().positive().max(COMPOSITION_MAX_CANVAS_PX),
  zIndex: z.number().int().min(0).max(9999),
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  adaptation: adaptationHintsSchema,
  /** Optional Design Token bindings — literals remain fallback when unbound / detached. */
  tokenBindings: tokenBindingsSchema,
});

export const textLayerSchema = baseLayerSchema.extend({
  type: z.literal('text'),
  text: z.string().max(8000),
  fontFamily: fontFamilySchema.default('system-ui, sans-serif'),
  fontSize: z.number().positive().max(512),
  fontWeight: z.union([z.number().int().min(100).max(900), z.string().max(20)]).default(400),
  lineHeight: z.number().positive().max(10).default(1.2),
  letterSpacing: z.number().finite().min(-50).max(100).default(0),
  textAlign: z.enum(['left', 'center', 'right']).default('left'),
  color: hexColorSchema.default('#ffffff'),
  backgroundColor: hexColorSchema.optional().nullable(),
  padding: z.number().nonnegative().max(200).default(0),
  borderRadius: z.number().nonnegative().max(200).default(0),
});

export const imageLayerSchema = baseLayerSchema.extend({
  type: z.literal('image'),
  assetId: z.string().uuid(),
  fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
});

export const componentInstanceLayerSchema = baseLayerSchema.extend({
  type: z.literal('component_instance'),
  componentId: z.string().uuid(),
  componentRevisionId: z.string().uuid(),
  overrides: componentOverridesSchema,
  fitMode: z.enum(['proportional', 'stretch']).default('proportional'),
  /** Optional Component Set provenance (variants). */
  componentSetId: z.string().uuid().optional().nullable(),
  variantProperties: variantCombinationSchema.optional().nullable(),
});

export const compositionLayerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
  componentInstanceLayerSchema,
]);

/** Primitive layers only (no Component Instances) — for Component Documents / detach output. */
export const compositionPrimitiveLayerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
]);

export const backgroundSchema = z.object({
  kind: z.enum(['asset', 'color']),
  assetId: z.string().uuid().optional().nullable(),
  color: hexColorSchema.optional().nullable(),
  fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  position: z.enum(POSITION_PRESETS).default('middle-center'),
  opacity: z.number().min(0).max(1).default(1),
  tokenBindings: tokenBindingsSchema,
});

export const canvasSchema = z.object({
  width: z.number().int().min(COMPOSITION_MIN_CANVAS_PX).max(COMPOSITION_MAX_CANVAS_PX),
  height: z.number().int().min(COMPOSITION_MIN_CANVAS_PX).max(COMPOSITION_MAX_CANVAS_PX),
  backgroundColor: hexColorSchema.optional().nullable(),
  transparent: z.boolean().default(false),
  safeArea: z
    .object({
      top: z.number().nonnegative().max(500).default(0),
      right: z.number().nonnegative().max(500).default(0),
      bottom: z.number().nonnegative().max(500).default(0),
      left: z.number().nonnegative().max(500).default(0),
    })
    .optional()
    .nullable(),
  tokenBindings: tokenBindingsSchema,
});

export const compositionDocumentSchema = z
  .object({
    version: z.literal(COMPOSITION_DOCUMENT_VERSION),
    canvas: canvasSchema,
    background: backgroundSchema,
    layers: z.array(compositionLayerSchema).max(64),
    guides: z.record(z.string(), z.unknown()).optional().nullable(),
    editorPrefs: z.record(z.string(), z.unknown()).optional().nullable(),
    /** Optional Design System pin mirrored into Composition row for convenience. */
    designSystem: designSystemContextSchema,
  })
  .superRefine((doc, ctx) => {
    const ids = new Set();
    for (const layer of doc.layers) {
      if (ids.has(layer.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate layer id: ${layer.id}`,
          path: ['layers'],
        });
      }
      ids.add(layer.id);
    }
    if (doc.background.kind === 'asset' && !doc.background.assetId) {
      ctx.addIssue({
        code: 'custom',
        message: 'background assetId required when kind is asset',
        path: ['background', 'assetId'],
      });
    }
    if (doc.background.kind === 'color' && !doc.background.color) {
      ctx.addIssue({
        code: 'custom',
        message: 'background color required when kind is color',
        path: ['background', 'color'],
      });
    }
  });

/**
 * @param {unknown} input
 */
export function parseCompositionDocument(input) {
  return compositionDocumentSchema.parse(input);
}

/**
 * Collect Asset IDs referenced by a document.
 * @param {z.infer<typeof compositionDocumentSchema>} doc
 */
export function collectDocumentAssetIds(doc) {
  const ids = new Set();
  if (doc.background?.kind === 'asset' && doc.background.assetId) {
    ids.add(doc.background.assetId);
  }
  for (const layer of doc.layers || []) {
    if (layer.type === 'image' && layer.assetId) ids.add(layer.assetId);
    if (layer.type === 'component_instance' && Array.isArray(layer.overrides)) {
      for (const ov of layer.overrides) {
        if (ov.type === 'asset' && typeof ov.value === 'string') ids.add(ov.value);
      }
    }
  }
  return [...ids];
}

/**
 * Collect pinned Component revision IDs from a Composition Document.
 * @param {z.infer<typeof compositionDocumentSchema>} doc
 */
export function collectDocumentComponentRevisionIds(doc) {
  const ids = new Set();
  for (const layer of doc.layers || []) {
    if (layer.type === 'component_instance' && layer.componentRevisionId) {
      ids.add(layer.componentRevisionId);
    }
  }
  return [...ids];
}
