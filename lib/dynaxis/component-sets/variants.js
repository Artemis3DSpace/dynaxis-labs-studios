/**
 * Component Set + variant resolution (client-safe).
 *
 * Revisions = time/version history.
 * Variants = selectable configurations within a Component Set.
 */

import { z } from 'zod';

export const componentSetAxisValueSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
});

export const componentSetAxisSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  values: z.array(componentSetAxisValueSchema).min(1).max(24),
});

export const componentSetAxesSchema = z.array(componentSetAxisSchema).min(1).max(8);

/** combination: axisId → valueId */
export const variantCombinationSchema = z.record(z.string().uuid(), z.string().uuid());

/**
 * Deterministic sparse-set key from a combination object.
 * @param {Record<string, string>} combination
 * @param {{ id: string }[]} axes — axis order for stable keys
 */
export function combinationKey(combination, axes) {
  const parts = [];
  for (const axis of axes) {
    const valueId = combination?.[axis.id];
    if (!valueId) {
      const err = new Error(`Missing variant value for axis ${axis.id}`);
      err.code = 'COMPONENT_VARIANT_INCOMPLETE';
      throw err;
    }
    parts.push(`${axis.id}=${valueId}`);
  }
  return parts.join('|');
}

/**
 * Validate combination against axes definitions.
 * @param {z.infer<typeof componentSetAxesSchema>} axes
 * @param {Record<string, string>} combination
 */
export function validateVariantCombination(axes, combination) {
  const errors = [];
  const normalized = {};
  for (const axis of axes) {
    const valueId = combination?.[axis.id];
    if (!valueId) {
      errors.push({
        code: 'COMPONENT_VARIANT_INCOMPLETE',
        message: `Missing value for axis "${axis.name}"`,
        axisId: axis.id,
      });
      continue;
    }
    if (!axis.values.some((v) => v.id === valueId)) {
      errors.push({
        code: 'COMPONENT_VARIANT_UNKNOWN_VALUE',
        message: `Unknown value for axis "${axis.name}"`,
        axisId: axis.id,
        valueId,
      });
      continue;
    }
    normalized[axis.id] = valueId;
  }
  // Reject extra axis keys
  for (const key of Object.keys(combination || {})) {
    if (!axes.some((a) => a.id === key)) {
      errors.push({
        code: 'COMPONENT_VARIANT_UNKNOWN_AXIS',
        message: `Unknown variant axis ${key}`,
        axisId: key,
      });
    }
  }
  return { combination: normalized, errors };
}

/**
 * Resolve a variant mapping entry from a list.
 * @param {object[]} variants — { combinationKey, combination, componentId, componentRevisionId }
 * @param {object[]} axes
 * @param {Record<string, string>} combination
 */
export function resolveComponentVariant(variants, axes, combination) {
  const { combination: normalized, errors } = validateVariantCombination(axes, combination);
  if (errors.length) {
    const err = new Error(errors[0].message);
    err.code = errors[0].code;
    err.errors = errors;
    throw err;
  }
  const key = combinationKey(normalized, axes);
  const match = (variants || []).find((v) => v.combinationKey === key);
  if (!match) {
    const err = new Error(`Variant combination unavailable: ${key}`);
    err.code = 'COMPONENT_VARIANT_UNAVAILABLE';
    err.combination = normalized;
    err.combinationKey = key;
    throw err;
  }
  return {
    combination: normalized,
    combinationKey: key,
    componentId: match.componentId,
    componentRevisionId: match.componentRevisionId,
    variantId: match.id || null,
    label: match.label || null,
  };
}

/**
 * Evaluate override compatibility when switching variants (reuse 6H conflict shape).
 * @param {object[]} fromProperties — component property defs
 * @param {object[]} toProperties
 * @param {object[]} overrides
 */
export function evaluateVariantSwitchOverrides(fromProperties, toProperties, overrides) {
  const toById = new Map((toProperties || []).map((p) => [p.id, p]));
  const compatible = [];
  const incompatible = [];
  const warnings = [];

  for (const ov of overrides || []) {
    const next = toById.get(ov.propertyId);
    if (!next) {
      incompatible.push({
        override: ov,
        code: 'COMPONENT_OVERRIDE_CONFLICT',
        message: `property ${ov.propertyId} not present on target variant`,
      });
      continue;
    }
    if (next.type !== ov.type) {
      incompatible.push({
        override: ov,
        code: 'COMPONENT_OVERRIDE_CONFLICT',
        message: `property ${ov.propertyId} type mismatch on target variant`,
      });
      continue;
    }
    const prev = (fromProperties || []).find((p) => p.id === ov.propertyId);
    if (prev && prev.targetLayerId !== next.targetLayerId) {
      warnings.push({
        propertyId: ov.propertyId,
        code: 'COMPONENT_PROPERTY_TARGET_CHANGED',
        message: `property ${ov.propertyId} retargeted on target variant`,
      });
    }
    compatible.push(ov);
  }

  return { compatible, incompatible, warnings };
}

export function parseComponentSetAxes(input) {
  return componentSetAxesSchema.parse(input);
}
