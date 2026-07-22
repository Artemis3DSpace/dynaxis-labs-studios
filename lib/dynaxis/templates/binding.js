/**
 * Design Template slot binding — typed context + deterministic precedence (client-safe).
 *
 * Precedence (documented):
 *   Text:  explicit user value → deliverable copy → template default
 *   Brand logo: explicit Asset → Brand primary_logo → template default → empty if optional
 *   Product:    explicit Asset → Product primary reference → template default
 *   Character:  explicit Asset → Character identity_reference → template default
 *   Background: explicit Asset → deliverable/generated Asset → template default
 */

import { z } from 'zod';
import { parseTemplateDocument } from './document.js';
import { parseCompositionDocument } from '../compositions/document.js';

export const templateBindingContextSchema = z
  .object({
    projectId: z.string().uuid(),
    brandId: z.string().uuid().optional().nullable(),
    brandRevisionId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    productRevisionId: z.string().uuid().optional().nullable(),
    characterId: z.string().uuid().optional().nullable(),
    characterRevisionId: z.string().uuid().optional().nullable(),
    campaignId: z.string().uuid().optional().nullable(),
    campaignRevisionId: z.string().uuid().optional().nullable(),
    campaignConceptId: z.string().uuid().optional().nullable(),
    campaignDeliverableId: z.string().uuid().optional().nullable(),
    /** Explicit slot overrides — key = slot id */
    textValues: z.record(z.string().uuid(), z.string().max(8000)).optional().nullable(),
    assetValues: z.record(z.string().uuid(), z.string().uuid()).optional().nullable(),
    /** Explicit variant axis values — key = slot id or axis id → value id */
    variantValues: z.record(z.string().uuid(), z.string().uuid()).optional().nullable(),
    /** Convenience copy fields (Campaign Deliverable style) */
    headline: z.string().max(8000).optional().nullable(),
    body: z.string().max(8000).optional().nullable(),
    cta: z.string().max(8000).optional().nullable(),
    eyebrow: z.string().max(8000).optional().nullable(),
    /** Generated / source background image for image slots with role background */
    backgroundAssetId: z.string().uuid().optional().nullable(),
    /** Resolved Asset IDs from Brand/Product/Character (server fills these) */
    resolved: z
      .object({
        brandLogoAssetId: z.string().uuid().optional().nullable(),
        brandReferenceAssetId: z.string().uuid().optional().nullable(),
        productAssetId: z.string().uuid().optional().nullable(),
        characterAssetId: z.string().uuid().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .strict();

/**
 * @param {unknown} input
 */
export function parseTemplateBindingContext(input) {
  return templateBindingContextSchema.parse(input);
}

function countWords(text) {
  const s = String(text || '').trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Resolve text for a text slot using deterministic precedence.
 * @param {object} slot
 * @param {z.infer<typeof templateBindingContextSchema>} ctx
 * @returns {{ value: string|null, source: string }}
 */
export function resolveTextSlotValue(slot, ctx) {
  const explicit = ctx.textValues?.[slot.id];
  if (explicit != null && String(explicit).trim() !== '') {
    return { value: String(explicit), source: 'explicit' };
  }

  const roleMap = {
    headline: ctx.headline,
    body: ctx.body,
    cta: ctx.cta,
    eyebrow: ctx.eyebrow,
  };
  if (slot.role in roleMap && roleMap[slot.role] != null && String(roleMap[slot.role]).trim() !== '') {
    return { value: String(roleMap[slot.role]), source: 'deliverable' };
  }

  if (slot.defaultText != null && String(slot.defaultText).trim() !== '') {
    return { value: String(slot.defaultText), source: 'template_default' };
  }

  return { value: null, source: 'empty' };
}

/**
 * Resolve image Asset ID for an image slot using deterministic precedence.
 * @param {object} slot
 * @param {z.infer<typeof templateBindingContextSchema>} ctx
 * @returns {{ assetId: string|null, source: string }}
 */
export function resolveImageSlotValue(slot, ctx) {
  const explicit = ctx.assetValues?.[slot.id];
  if (explicit) return { assetId: explicit, source: 'explicit' };

  const resolved = ctx.resolved || {};

  if (slot.role === 'background' || slot.targetBackground) {
    if (ctx.backgroundAssetId) {
      return { assetId: ctx.backgroundAssetId, source: 'background' };
    }
  }

  if (slot.role === 'brand_logo' && resolved.brandLogoAssetId) {
    return { assetId: resolved.brandLogoAssetId, source: 'brand_logo' };
  }
  if (slot.role === 'brand_reference' && resolved.brandReferenceAssetId) {
    return { assetId: resolved.brandReferenceAssetId, source: 'brand_reference' };
  }
  if (slot.role === 'product' && resolved.productAssetId) {
    return { assetId: resolved.productAssetId, source: 'product' };
  }
  if (slot.role === 'character' && resolved.characterAssetId) {
    return { assetId: resolved.characterAssetId, source: 'character' };
  }

  if (slot.defaultAssetId) {
    return { assetId: slot.defaultAssetId, source: 'template_default' };
  }

  return { assetId: null, source: 'empty' };
}

function upsertComponentOverride(layer, propertyId, type, value) {
  const overrides = Array.isArray(layer.overrides) ? [...layer.overrides] : [];
  const idx = overrides.findIndex((o) => o.propertyId === propertyId);
  const next = { propertyId, type, value };
  if (idx >= 0) overrides[idx] = next;
  else overrides.push(next);
  return { ...layer, overrides };
}

/**
 * Bind slots into a Composition Document. Pure — does not touch the Template.
 * @param {unknown} templateDocInput
 * @param {unknown} bindingContextInput
 * @returns {{ document: object, bindings: object[], errors: object[] }}
 */
export function bindTemplateSlots(templateDocInput, bindingContextInput) {
  const templateDoc = parseTemplateDocument(templateDocInput);
  const ctx = parseTemplateBindingContext(bindingContextInput);
  const errors = [];
  const bindings = [];

  let background = { ...templateDoc.background };
  const layers = templateDoc.layers.map((l) => ({ ...l }));

  for (const slot of templateDoc.slots) {
    if (slot.type === 'text') {
      const { value, source } = resolveTextSlotValue(slot, ctx);
      if (value == null || value.trim() === '') {
        if (slot.required) {
          errors.push({
            code: 'TEMPLATE_REQUIRED_SLOT_MISSING',
            slotId: slot.id,
            role: slot.role,
            type: 'text',
            message: `Required text slot "${slot.role}" could not be fulfilled`,
          });
        }
        bindings.push({ slotId: slot.id, type: 'text', source, value: null });
        continue;
      }
      if (slot.constraints?.maxLength && value.length > slot.constraints.maxLength) {
        errors.push({
          code: 'TEMPLATE_SLOT_CONSTRAINT',
          slotId: slot.id,
          message: `Text exceeds maxLength ${slot.constraints.maxLength}`,
        });
      }
      if (slot.constraints?.maxWords && countWords(value) > slot.constraints.maxWords) {
        errors.push({
          code: 'TEMPLATE_SLOT_CONSTRAINT',
          slotId: slot.id,
          message: `Text exceeds maxWords ${slot.constraints.maxWords}`,
        });
      }

      if (slot.targetComponentInstanceLayerId && slot.targetPropertyId) {
        const idx = layers.findIndex((l) => l.id === slot.targetComponentInstanceLayerId);
        if (idx >= 0 && layers[idx].type === 'component_instance') {
          layers[idx] = upsertComponentOverride(
            layers[idx],
            slot.targetPropertyId,
            'text',
            value
          );
        } else {
          errors.push({
            code: 'TEMPLATE_COMPONENT_TARGET_MISSING',
            slotId: slot.id,
            message: 'Text slot Component Instance target missing',
          });
        }
      } else {
        const idx = layers.findIndex((l) => l.id === slot.targetLayerId);
        if (idx >= 0 && layers[idx].type === 'text') {
          layers[idx] = { ...layers[idx], text: value };
        }
      }
      bindings.push({ slotId: slot.id, type: 'text', source, value });
      continue;
    }

    if (slot.type === 'variant') {
      const idx = layers.findIndex((l) => l.id === slot.targetComponentInstanceLayerId);
      if (idx < 0 || layers[idx].type !== 'component_instance') {
        errors.push({
          code: 'TEMPLATE_COMPONENT_TARGET_MISSING',
          slotId: slot.id,
          message: 'Variant slot Component Instance target missing',
        });
        bindings.push({ slotId: slot.id, type: 'variant', valueId: null });
        continue;
      }
      const layer = layers[idx];
      const valueId =
        ctx.variantValues?.[slot.id] ||
        ctx.variantValues?.[slot.targetVariantAxisId] ||
        slot.defaultValueId ||
        layer.variantProperties?.[slot.targetVariantAxisId] ||
        null;
      if (!valueId) {
        if (slot.required) {
          errors.push({
            code: 'TEMPLATE_REQUIRED_SLOT_MISSING',
            slotId: slot.id,
            type: 'variant',
            message: 'Required variant slot could not be fulfilled',
          });
        }
        bindings.push({ slotId: slot.id, type: 'variant', valueId: null });
        continue;
      }
      layers[idx] = {
        ...layer,
        variantProperties: {
          ...(layer.variantProperties || {}),
          [slot.targetVariantAxisId]: valueId,
        },
      };
      bindings.push({
        slotId: slot.id,
        type: 'variant',
        axisId: slot.targetVariantAxisId,
        valueId,
      });
      continue;
    }

    // image
    const { assetId, source } = resolveImageSlotValue(slot, ctx);
    if (!assetId) {
      if (slot.required) {
        errors.push({
          code: 'TEMPLATE_REQUIRED_SLOT_MISSING',
          slotId: slot.id,
          role: slot.role,
          type: 'image',
          message: `Required image slot "${slot.role}" could not be fulfilled`,
        });
      }
      bindings.push({ slotId: slot.id, type: 'image', source, assetId: null });
      continue;
    }

    if (slot.targetBackground || slot.role === 'background') {
      background = {
        ...background,
        kind: 'asset',
        assetId,
        fit: slot.constraints?.fit || background.fit || 'cover',
      };
    } else if (slot.targetComponentInstanceLayerId && slot.targetPropertyId) {
      const idx = layers.findIndex((l) => l.id === slot.targetComponentInstanceLayerId);
      if (idx >= 0 && layers[idx].type === 'component_instance') {
        layers[idx] = upsertComponentOverride(
          layers[idx],
          slot.targetPropertyId,
          'asset',
          assetId
        );
      } else {
        errors.push({
          code: 'TEMPLATE_COMPONENT_TARGET_MISSING',
          slotId: slot.id,
          message: 'Image slot Component Instance target missing',
        });
      }
    } else {
      const idx = layers.findIndex((l) => l.id === slot.targetLayerId);
      if (idx >= 0 && layers[idx].type === 'image') {
        layers[idx] = {
          ...layers[idx],
          assetId,
          fit: slot.constraints?.fit || layers[idx].fit || 'cover',
        };
      }
    }
    bindings.push({ slotId: slot.id, type: 'image', source, assetId });
  }

  const document = parseCompositionDocument({
    version: 1,
    canvas: templateDoc.canvas,
    background,
    layers,
    guides: null,
    editorPrefs: null,
    designSystem: templateDoc.designSystem || null,
  });

  return { document, bindings, errors };
}
