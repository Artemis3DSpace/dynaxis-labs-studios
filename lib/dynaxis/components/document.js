/**
 * Dynaxis Design Component Document — versioned Zod schema (client-safe).
 *
 * A Component Document is a reusable visual fragment with intrinsic dimensions.
 * Phase 6H: text + image layers only — NO nested component_instance layers.
 */

import { z } from 'zod';
import {
  DESIGN_COMPONENT_DOCUMENT_VERSION,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
} from '../types.js';
import {
  textLayerSchema,
  imageLayerSchema,
  collectDocumentAssetIds,
} from '../compositions/document.js';
import { componentPropertyDefinitionSchema } from './properties.js';
import { designSystemContextSchema } from '../design-systems/bindings.js';

/** Primitive layers only — nested Components rejected. */
export const componentPrimitiveLayerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
]);

export const componentDocumentSchema = z
  .object({
    version: z.literal(DESIGN_COMPONENT_DOCUMENT_VERSION),
    intrinsicWidth: z
      .number()
      .int()
      .min(COMPOSITION_MIN_CANVAS_PX)
      .max(COMPOSITION_MAX_CANVAS_PX),
    intrinsicHeight: z
      .number()
      .int()
      .min(COMPOSITION_MIN_CANVAS_PX)
      .max(COMPOSITION_MAX_CANVAS_PX),
    layers: z.array(componentPrimitiveLayerSchema).max(48),
    properties: z.array(componentPropertyDefinitionSchema).max(48).default([]),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    /** Optional pinned Design System revision for Component-local token bindings. */
    designSystem: designSystemContextSchema,
    hints: z
      .object({
        fitModeDefault: z.enum(['proportional', 'stretch']).optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
      })
      .optional()
      .nullable(),
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
      // Defence-in-depth: reject any nested component_instance if somehow present
      if (/** @type {any} */ (layer).type === 'component_instance') {
        ctx.addIssue({
          code: 'custom',
          message: 'nested Component Instances are not allowed in Component Documents (Phase 6H)',
          path: ['layers'],
        });
      }
    }

    const propIds = new Set();
    for (const prop of doc.properties) {
      if (propIds.has(prop.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate property id: ${prop.id}`,
          path: ['properties'],
        });
      }
      propIds.add(prop.id);

      if (!ids.has(prop.targetLayerId)) {
        ctx.addIssue({
          code: 'custom',
          message: `property target layer missing: ${prop.targetLayerId}`,
          path: ['properties'],
        });
        continue;
      }
      const layer = doc.layers.find((l) => l.id === prop.targetLayerId);
      if (!layer) continue;

      if (prop.type === 'text' && layer.type !== 'text') {
        ctx.addIssue({
          code: 'custom',
          message: `text property must target a text layer`,
          path: ['properties'],
        });
      }
      if (prop.type === 'asset' && layer.type !== 'image') {
        ctx.addIssue({
          code: 'custom',
          message: `asset property must target an image layer`,
          path: ['properties'],
        });
      }
      if (prop.type === 'colour' && layer.type !== 'text') {
        ctx.addIssue({
          code: 'custom',
          message: `colour property must target a text layer in Phase 6H`,
          path: ['properties'],
        });
      }
    }
  });

/**
 * @param {unknown} input
 */
export function parseComponentDocument(input) {
  return componentDocumentSchema.parse(input);
}

/**
 * @param {z.infer<typeof componentDocumentSchema>} doc
 */
export function collectComponentDocumentAssetIds(doc) {
  return collectDocumentAssetIds({
    background: { kind: 'color', color: '#000000' },
    layers: doc.layers,
  });
}

/**
 * Build a pseudo Composition Document for thumbnail rendering of a Component revision.
 * @param {z.infer<typeof componentDocumentSchema>} componentDoc
 * @param {{ backgroundColor?: string }} [opts]
 */
export function componentDocumentToCompositionDocument(componentDoc, opts = {}) {
  const doc = parseComponentDocument(componentDoc);
  return {
    version: 1,
    canvas: {
      width: doc.intrinsicWidth,
      height: doc.intrinsicHeight,
      backgroundColor: opts.backgroundColor ?? '#000000',
      transparent: false,
      safeArea: null,
    },
    background: {
      kind: 'color',
      color: opts.backgroundColor ?? '#000000',
      fit: 'cover',
      position: 'middle-center',
      opacity: 1,
    },
    layers: doc.layers,
    guides: null,
    editorPrefs: null,
  };
}

export { DESIGN_COMPONENT_DOCUMENT_VERSION };
