/**
 * Design Component property definitions + override validation (client-safe).
 *
 * Property types (Phase 6H):
 *   text | asset | colour | visibility
 *
 * No arbitrary JSON paths — only known targetLayerId + targetProperty.
 */

import { z } from 'zod';
import { DESIGN_COMPONENT_PROPERTY_TYPES } from '../types.js';
import { normalizeHexColor } from '../compositions/colors.js';

const hexColorSchema = z
  .string()
  .trim()
  .refine((v) => !v || normalizeHexColor(v) != null, 'invalid color');

/** Allowed target properties per property type. */
export const COMPONENT_PROPERTY_TARGETS = /** @type {const} */ ({
  text: ['text'],
  asset: ['assetId'],
  colour: ['color', 'backgroundColor'],
  visibility: ['visible'],
});

export const componentPropertyDefinitionSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    type: z.enum(DESIGN_COMPONENT_PROPERTY_TYPES),
    targetLayerId: z.string().uuid(),
    targetProperty: z.string().trim().min(1).max(64),
    required: z.boolean().default(false),
    defaultValue: z.union([z.string(), z.boolean(), z.null()]).optional().nullable(),
    /** Optional semantic role for Design Agent / Template binding (not a free-form path). */
    semanticRole: z
      .enum([
        'headline',
        'body',
        'cta',
        'eyebrow',
        'product',
        'character',
        'avatar',
        'brand_logo',
        'custom',
      ])
      .optional()
      .nullable(),
  })
  .superRefine((prop, ctx) => {
    const allowed = COMPONENT_PROPERTY_TARGETS[prop.type];
    if (!allowed?.includes(prop.targetProperty)) {
      ctx.addIssue({
        code: 'custom',
        message: `property type ${prop.type} cannot target ${prop.targetProperty}`,
        path: ['targetProperty'],
      });
    }
    if (prop.defaultValue != null) {
      if (prop.type === 'visibility' && typeof prop.defaultValue !== 'boolean') {
        ctx.addIssue({
          code: 'custom',
          message: 'visibility defaultValue must be boolean',
          path: ['defaultValue'],
        });
      }
      if (prop.type === 'text' && typeof prop.defaultValue !== 'string') {
        ctx.addIssue({
          code: 'custom',
          message: 'text defaultValue must be string',
          path: ['defaultValue'],
        });
      }
      if (prop.type === 'asset' && typeof prop.defaultValue === 'string') {
        // uuid validated loosely here; ownership checked server-side
        if (!/^[0-9a-f-]{36}$/i.test(prop.defaultValue)) {
          ctx.addIssue({
            code: 'custom',
            message: 'asset defaultValue must be a uuid',
            path: ['defaultValue'],
          });
        }
      }
      if (prop.type === 'colour' && typeof prop.defaultValue === 'string') {
        if (normalizeHexColor(prop.defaultValue) == null) {
          ctx.addIssue({
            code: 'custom',
            message: 'colour defaultValue must be a valid colour',
            path: ['defaultValue'],
          });
        }
      }
    }
  });

export const componentOverrideSchema = z
  .object({
    propertyId: z.string().uuid(),
    type: z.enum(DESIGN_COMPONENT_PROPERTY_TYPES),
    value: z.union([z.string().max(8000), z.boolean()]),
  })
  .superRefine((ov, ctx) => {
    if (ov.type === 'visibility' && typeof ov.value !== 'boolean') {
      ctx.addIssue({ code: 'custom', message: 'visibility override must be boolean' });
    }
    if (ov.type === 'text' && typeof ov.value !== 'string') {
      ctx.addIssue({ code: 'custom', message: 'text override must be string' });
    }
    if (ov.type === 'asset') {
      if (typeof ov.value !== 'string' || !/^[0-9a-f-]{36}$/i.test(ov.value)) {
        ctx.addIssue({ code: 'custom', message: 'asset override must be a uuid Asset id' });
      }
    }
    if (ov.type === 'colour') {
      if (typeof ov.value !== 'string' || normalizeHexColor(ov.value) == null) {
        ctx.addIssue({ code: 'custom', message: 'colour override must be a valid colour' });
      }
    }
  });

export const componentOverridesSchema = z.array(componentOverrideSchema).max(48).default([]);

/**
 * Validate overrides against property definitions from a pinned Component revision.
 * @param {z.infer<typeof componentPropertyDefinitionSchema>[]} definitions
 * @param {unknown} overridesInput
 * @returns {{ overrides: z.infer<typeof componentOverrideSchema>[], errors: { code: string, message: string, propertyId?: string }[] }}
 */
export function validateComponentOverrides(definitions, overridesInput) {
  const errors = [];
  const byId = new Map(definitions.map((d) => [d.id, d]));
  let parsed;
  try {
    parsed = componentOverridesSchema.parse(overridesInput ?? []);
  } catch (err) {
    return {
      overrides: [],
      errors: [{ code: 'COMPONENT_OVERRIDE_INVALID', message: err?.message || 'invalid overrides' }],
    };
  }

  const seen = new Set();
  const valid = [];
  for (const ov of parsed) {
    if (seen.has(ov.propertyId)) {
      errors.push({
        code: 'COMPONENT_OVERRIDE_DUPLICATE',
        message: `duplicate override for property ${ov.propertyId}`,
        propertyId: ov.propertyId,
      });
      continue;
    }
    seen.add(ov.propertyId);

    const def = byId.get(ov.propertyId);
    if (!def) {
      errors.push({
        code: 'COMPONENT_OVERRIDE_UNKNOWN_PROPERTY',
        message: `unknown property ${ov.propertyId}`,
        propertyId: ov.propertyId,
      });
      continue;
    }
    if (def.type !== ov.type) {
      errors.push({
        code: 'COMPONENT_OVERRIDE_WRONG_TYPE',
        message: `override type ${ov.type} does not match property type ${def.type}`,
        propertyId: ov.propertyId,
      });
      continue;
    }
    valid.push(ov);
  }

  for (const def of definitions) {
    if (!def.required) continue;
    const hasOverride = valid.some((o) => o.propertyId === def.id);
    const hasDefault = def.defaultValue != null;
    if (!hasOverride && !hasDefault) {
      // Required with no default is a soft warning at instance time only when empty —
      // master may leave required props to be filled on insert.
    }
  }

  return { overrides: valid, errors };
}

/**
 * Compare overrides when updating instance to a new Component revision.
 * @param {z.infer<typeof componentPropertyDefinitionSchema>[]} fromDefs
 * @param {z.infer<typeof componentPropertyDefinitionSchema>[]} toDefs
 * @param {z.infer<typeof componentOverrideSchema>[]} overrides
 */
export function evaluateComponentRevisionUpdate(fromDefs, toDefs, overrides) {
  const toById = new Map(toDefs.map((d) => [d.id, d]));
  const compatible = [];
  const incompatible = [];
  const warnings = [];

  for (const ov of overrides || []) {
    const next = toById.get(ov.propertyId);
    if (!next) {
      incompatible.push({
        override: ov,
        code: 'COMPONENT_OVERRIDE_CONFLICT',
        message: `property ${ov.propertyId} removed in target revision`,
      });
      continue;
    }
    if (next.type !== ov.type) {
      incompatible.push({
        override: ov,
        code: 'COMPONENT_OVERRIDE_CONFLICT',
        message: `property ${ov.propertyId} type changed (${ov.type} → ${next.type})`,
      });
      continue;
    }
    if (next.targetLayerId !== fromDefs.find((d) => d.id === ov.propertyId)?.targetLayerId) {
      warnings.push({
        propertyId: ov.propertyId,
        code: 'COMPONENT_PROPERTY_TARGET_CHANGED',
        message: `property ${ov.propertyId} retargeted to a different layer`,
      });
    }
    compatible.push(ov);
  }

  return { compatible, incompatible, warnings };
}

/**
 * Map Template-style slot role values onto Component property overrides by semanticRole.
 * Unit helper for Template slot → Component property binding (Phase 6H).
 *
 * @param {z.infer<typeof componentPropertyDefinitionSchema>[]} properties
 * @param {{ role: string, type?: string, value: string|boolean }[]} slotBindings
 * @returns {{ overrides: z.infer<typeof componentOverrideSchema>[], unbound: object[] }}
 */
export function bindTemplateSlotsToComponentOverrides(properties, slotBindings) {
  const overrides = [];
  const unbound = [];
  const byRole = new Map();
  for (const prop of properties || []) {
    if (prop.semanticRole) byRole.set(prop.semanticRole, prop);
  }
  for (const slot of slotBindings || []) {
    const prop = byRole.get(slot.role);
    if (!prop) {
      unbound.push(slot);
      continue;
    }
    if (slot.type && slot.type !== prop.type) {
      unbound.push({ ...slot, reason: 'type_mismatch' });
      continue;
    }
    overrides.push({
      propertyId: prop.id,
      type: prop.type,
      value: slot.value,
    });
  }
  return { overrides, unbound };
}

export { hexColorSchema };
