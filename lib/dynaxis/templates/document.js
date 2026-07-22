/**
 * Dynaxis Design Template Document — versioned Zod schema (client-safe).
 * Reuses Composition layer primitives; compiles to Composition Document on instantiate.
 */

import { z } from 'zod';
import {
  DESIGN_TEMPLATE_DOCUMENT_VERSION,
  DESIGN_TEMPLATE_SLOT_TYPES,
  DESIGN_TEMPLATE_TEXT_ROLES,
  DESIGN_TEMPLATE_IMAGE_ROLES,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
} from '../types.js';
import {
  compositionLayerSchema,
  backgroundSchema,
  canvasSchema,
  parseCompositionDocument,
  collectDocumentAssetIds,
} from '../compositions/document.js';
import { designSystemContextSchema } from '../design-systems/bindings.js';

export const templateTextSlotSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('text'),
  role: z.enum(DESIGN_TEMPLATE_TEXT_ROLES),
  required: z.boolean().default(false),
  targetLayerId: z.string().uuid().optional().nullable(),
  /** Explicit mapping into a Component Instance property (Phase 6H). */
  targetComponentInstanceLayerId: z.string().uuid().optional().nullable(),
  targetPropertyId: z.string().uuid().optional().nullable(),
  defaultText: z.string().max(8000).optional().nullable(),
  constraints: z
    .object({
      maxLength: z.number().int().positive().max(8000).optional().nullable(),
      maxWords: z.number().int().positive().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const templateImageSlotSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('image'),
  role: z.enum(DESIGN_TEMPLATE_IMAGE_ROLES),
  required: z.boolean().default(false),
  targetLayerId: z.string().uuid().optional().nullable(),
  targetComponentInstanceLayerId: z.string().uuid().optional().nullable(),
  targetPropertyId: z.string().uuid().optional().nullable(),
  /** When role is background, binds document.background instead of a layer. */
  targetBackground: z.boolean().default(false),
  defaultAssetId: z.string().uuid().optional().nullable(),
  constraints: z
    .object({
      fit: z.enum(['cover', 'contain', 'fill']).optional().nullable(),
      preserveAspectRatio: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
});

/** Explicit Template slot → Component Set variant axis mapping. */
export const templateVariantSlotSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('variant'),
  required: z.boolean().default(false),
  targetComponentInstanceLayerId: z.string().uuid(),
  targetVariantAxisId: z.string().uuid(),
  defaultValueId: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const templateSlotSchema = z.discriminatedUnion('type', [
  templateTextSlotSchema,
  templateImageSlotSchema,
  templateVariantSlotSchema,
]);

export const templateAdaptationHintsSchema = z
  .object({
    preferredFormats: z.array(z.string().max(64)).max(16).optional().nullable(),
    baseAspectRatio: z.string().max(16).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .optional()
  .nullable();

export const templateBrandHintsSchema = z
  .object({
    brandBinding: z.enum(['neutral', 'bound']).default('neutral'),
    brandId: z.string().uuid().optional().nullable(),
    brandRevisionId: z.string().uuid().optional().nullable(),
    preferPrimaryLogo: z.boolean().default(true),
    preferBrandFonts: z.boolean().default(true),
    preferBrandPalette: z.boolean().default(true),
  })
  .optional()
  .nullable();

export const templateDocumentSchema = z
  .object({
    version: z.literal(DESIGN_TEMPLATE_DOCUMENT_VERSION),
    canvas: canvasSchema,
    background: backgroundSchema,
    layers: z.array(compositionLayerSchema).max(64),
    slots: z.array(templateSlotSchema).max(48).default([]),
    adaptationHints: templateAdaptationHintsSchema,
    brandHints: templateBrandHintsSchema,
    formatMetadata: z
      .object({
        aspectRatio: z.string().max(16).optional().nullable(),
        formatId: z.string().max(64).optional().nullable(),
      })
      .optional()
      .nullable(),
    /** Optional pinned Design System revision + default mode selections. */
    designSystem: designSystemContextSchema,
  })
  .superRefine((doc, ctx) => {
    const layerIds = new Set(doc.layers.map((l) => l.id));
    const slotIds = new Set();
    for (const slot of doc.slots) {
      if (slotIds.has(slot.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate slot id: ${slot.id}`,
          path: ['slots'],
        });
      }
      slotIds.add(slot.id);

      if (slot.type === 'text') {
        const targetsComponent = Boolean(
          slot.targetComponentInstanceLayerId && slot.targetPropertyId
        );
        if (targetsComponent) {
          if (!layerIds.has(slot.targetComponentInstanceLayerId)) {
            ctx.addIssue({
              code: 'custom',
              message: `text slot component instance missing: ${slot.targetComponentInstanceLayerId}`,
              path: ['slots'],
            });
          } else {
            const layer = doc.layers.find((l) => l.id === slot.targetComponentInstanceLayerId);
            if (layer && layer.type !== 'component_instance') {
              ctx.addIssue({
                code: 'custom',
                message: `text slot component target must be a component_instance layer`,
                path: ['slots'],
              });
            }
          }
        } else if (!slot.targetLayerId || !layerIds.has(slot.targetLayerId)) {
          ctx.addIssue({
            code: 'custom',
            message: `text slot target layer missing: ${slot.targetLayerId}`,
            path: ['slots'],
          });
        } else {
          const layer = doc.layers.find((l) => l.id === slot.targetLayerId);
          if (layer && layer.type !== 'text') {
            ctx.addIssue({
              code: 'custom',
              message: `text slot must target a text layer: ${slot.targetLayerId}`,
              path: ['slots'],
            });
          }
        }
      }

      if (slot.type === 'image') {
        const targetsComponent = Boolean(
          slot.targetComponentInstanceLayerId && slot.targetPropertyId
        );
        if (slot.targetBackground) {
          if (slot.targetLayerId || targetsComponent) {
            ctx.addIssue({
              code: 'custom',
              message: 'background image slot must not set layer/component targets',
              path: ['slots'],
            });
          }
        } else if (targetsComponent) {
          if (!layerIds.has(slot.targetComponentInstanceLayerId)) {
            ctx.addIssue({
              code: 'custom',
              message: `image slot component instance missing: ${slot.targetComponentInstanceLayerId}`,
              path: ['slots'],
            });
          } else {
            const layer = doc.layers.find((l) => l.id === slot.targetComponentInstanceLayerId);
            if (layer && layer.type !== 'component_instance') {
              ctx.addIssue({
                code: 'custom',
                message: `image slot component target must be a component_instance layer`,
                path: ['slots'],
              });
            }
          }
        } else if (!slot.targetLayerId || !layerIds.has(slot.targetLayerId)) {
          ctx.addIssue({
            code: 'custom',
            message: `image slot target layer missing: ${slot.targetLayerId || '(none)'}`,
            path: ['slots'],
          });
        } else {
          const layer = doc.layers.find((l) => l.id === slot.targetLayerId);
          if (layer && layer.type !== 'image' && layer.type !== 'component_instance') {
            ctx.addIssue({
              code: 'custom',
              message: `image slot must target an image layer: ${slot.targetLayerId}`,
              path: ['slots'],
            });
          }
        }
      }

      if (slot.type === 'variant') {
        if (!layerIds.has(slot.targetComponentInstanceLayerId)) {
          ctx.addIssue({
            code: 'custom',
            message: `variant slot component instance missing: ${slot.targetComponentInstanceLayerId}`,
            path: ['slots'],
          });
        } else {
          const layer = doc.layers.find((l) => l.id === slot.targetComponentInstanceLayerId);
          if (!layer || layer.type !== 'component_instance') {
            ctx.addIssue({
              code: 'custom',
              message: 'variant slot must target a component_instance layer',
              path: ['slots'],
            });
          } else if (!layer.componentSetId) {
            ctx.addIssue({
              code: 'custom',
              message: 'variant slot target instance must belong to a Component Set',
              path: ['slots'],
            });
          }
        }
      }
    }
  });

/**
 * @param {unknown} input
 */
export function parseTemplateDocument(input) {
  return templateDocumentSchema.parse(input);
}

/**
 * Strip Composition-transient fields and build a Template Document from a Composition Document.
 * @param {import('../compositions/document.js').compositionDocumentSchema extends import('zod').ZodTypeAny ? import('zod').infer<typeof import('../compositions/document.js').compositionDocumentSchema> : never} compositionDoc
 * @param {{ slots?: unknown[], adaptationHints?: unknown, brandHints?: unknown, formatMetadata?: unknown }} [opts]
 */
export function compositionDocumentToTemplateDocument(compositionDoc, opts = {}) {
  const parsed = parseCompositionDocument(compositionDoc);
  return parseTemplateDocument({
    version: DESIGN_TEMPLATE_DOCUMENT_VERSION,
    canvas: parsed.canvas,
    background: parsed.background,
    layers: parsed.layers,
    slots: opts.slots || [],
    adaptationHints: opts.adaptationHints ?? null,
    brandHints: opts.brandHints ?? { brandBinding: 'neutral' },
    formatMetadata: opts.formatMetadata ?? null,
  });
}

/**
 * Compile Template Document layers into a Composition Document (slots applied separately).
 * @param {z.infer<typeof templateDocumentSchema>} templateDoc
 */
export function templateDocumentToCompositionDocument(templateDoc) {
  const doc = parseTemplateDocument(templateDoc);
  return parseCompositionDocument({
    version: 1,
    canvas: doc.canvas,
    background: doc.background,
    layers: doc.layers,
    guides: null,
    editorPrefs: null,
  });
}

/**
 * @param {z.infer<typeof templateDocumentSchema>} doc
 */
export function collectTemplateDocumentAssetIds(doc) {
  const ids = new Set(collectDocumentAssetIds(doc));
  for (const slot of doc.slots || []) {
    if (slot.type === 'image' && slot.defaultAssetId) ids.add(slot.defaultAssetId);
  }
  return [...ids];
}

export {
  DESIGN_TEMPLATE_DOCUMENT_VERSION,
  DESIGN_TEMPLATE_SLOT_TYPES,
  DESIGN_TEMPLATE_TEXT_ROLES,
  DESIGN_TEMPLATE_IMAGE_ROLES,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
};
