/**
 * Token binding schemas + apply resolved tokens onto Composition/Component layers (client-safe).
 *
 * Literal fields remain the fallback / detached value. Bindings reference tokenId only.
 */

import { z } from 'zod';
import { DESIGN_TOKEN_BINDABLE_PROPERTIES } from '../types.js';
import { resolveDesignToken } from './resolver.js';
import { normalizeHexColor } from '../compositions/colors.js';

export const tokenBindingRefSchema = z.object({
  tokenId: z.string().uuid(),
});

export const tokenBindingsSchema = z
  .partialRecord(z.enum(DESIGN_TOKEN_BINDABLE_PROPERTIES), tokenBindingRefSchema)
  .optional()
  .nullable();

export const designSystemContextSchema = z
  .object({
    designSystemId: z.string().uuid().optional().nullable(),
    designSystemRevisionId: z.string().uuid().optional().nullable(),
    /** collectionId → modeId */
    modes: z.record(z.string().uuid(), z.string().uuid()).optional().nullable(),
  })
  .optional()
  .nullable();

/** Property → expected token primitive type */
export const TOKEN_BINDING_EXPECTED_TYPE = /** @type {const} */ ({
  color: 'colour',
  backgroundColor: 'colour',
  canvasBackgroundColor: 'colour',
  fontFamily: 'string',
  fontSize: 'number',
  fontWeight: 'number',
  lineHeight: 'number',
  letterSpacing: 'number',
  padding: 'number',
  borderRadius: 'number',
  opacity: 'number',
});

/**
 * Collect token IDs referenced by a Composition-like document.
 * @param {object} doc
 */
export function collectDocumentTokenIds(doc) {
  const ids = new Set();
  const canvasBindings = doc.canvas?.tokenBindings || doc.tokenBindings;
  if (canvasBindings?.canvasBackgroundColor?.tokenId) {
    ids.add(canvasBindings.canvasBackgroundColor.tokenId);
  }
  if (doc.background?.tokenBindings?.color?.tokenId) {
    ids.add(doc.background.tokenBindings.color.tokenId);
  }
  for (const layer of doc.layers || []) {
    const bindings = layer.tokenBindings || {};
    for (const ref of Object.values(bindings)) {
      if (ref?.tokenId) ids.add(ref.tokenId);
    }
  }
  return [...ids];
}

/**
 * Apply token bindings onto a document clone for rendering/preview.
 * Does not mutate Design Tokens. Unresolved bindings throw structured errors
 * when rejectUnresolved is true; otherwise leave literal fallback.
 *
 * @param {object} documentInput — Composition Document (or Component Document as layers)
 * @param {unknown} tokenDocument
 * @param {{ modesByCollection?: Record<string,string>, rejectUnresolved?: boolean }} [opts]
 */
export function applyTokenBindingsToDocument(documentInput, tokenDocument, opts = {}) {
  if (!tokenDocument) {
    return { document: documentInput, warnings: [], errors: [] };
  }

  const warnings = [];
  const errors = [];
  const doc = JSON.parse(JSON.stringify(documentInput));
  const modeContext = { modesByCollection: opts.modesByCollection || {} };

  function applyBinding(target, property, binding) {
    if (!binding?.tokenId) return;
    try {
      const resolved = resolveDesignToken(tokenDocument, binding.tokenId, modeContext);
      const expected = TOKEN_BINDING_EXPECTED_TYPE[property];
      if (expected && resolved.type !== expected) {
        const err = {
          code: 'DESIGN_TOKEN_BINDING_TYPE_MISMATCH',
          message: `token ${binding.tokenId} type ${resolved.type} incompatible with ${property}`,
          tokenId: binding.tokenId,
          property,
        };
        if (opts.rejectUnresolved) throw Object.assign(new Error(err.message), err);
        errors.push(err);
        return;
      }
      warnings.push(...(resolved.warnings || []));
      if (property === 'canvasBackgroundColor') {
        target.backgroundColor = resolved.value;
      } else if (property === 'color' && target.kind === 'color') {
        target.color = resolved.value;
      } else {
        target[property] = resolved.value;
      }
    } catch (err) {
      const payload = {
        code: err.code || 'DESIGN_TOKEN_BINDING_CONFLICT',
        message: err.message,
        tokenId: binding.tokenId,
        property,
      };
      if (opts.rejectUnresolved) {
        throw Object.assign(new Error(payload.message), payload);
      }
      errors.push(payload);
    }
  }

  if (doc.canvas?.tokenBindings) {
    for (const [prop, binding] of Object.entries(doc.canvas.tokenBindings)) {
      applyBinding(doc.canvas, prop, binding);
    }
  }

  if (doc.background?.tokenBindings?.color) {
    applyBinding(doc.background, 'color', doc.background.tokenBindings.color);
  }

  for (const layer of doc.layers || []) {
    if (!layer.tokenBindings) continue;
    for (const [prop, binding] of Object.entries(layer.tokenBindings)) {
      applyBinding(layer, prop, binding);
    }
  }

  return { document: doc, warnings, errors };
}

/**
 * Detach a token binding: materialize current resolved value as literal and remove binding.
 */
export function detachTokenBinding(target, property, tokenDocument, modeContext = {}) {
  const bindings = { ...(target.tokenBindings || {}) };
  const binding = bindings[property];
  if (!binding?.tokenId) {
    return { target, detached: false };
  }
  let literal = target[property];
  if (tokenDocument) {
    try {
      const resolved = resolveDesignToken(tokenDocument, binding.tokenId, modeContext);
      literal = resolved.value;
    } catch {
      // keep existing literal
    }
  }
  if (property === 'color' || property === 'backgroundColor' || property === 'canvasBackgroundColor') {
    if (typeof literal === 'string') literal = normalizeHexColor(literal) || literal;
  }
  delete bindings[property];
  const next = {
    ...target,
    tokenBindings: Object.keys(bindings).length ? bindings : null,
  };
  if (property === 'canvasBackgroundColor') next.backgroundColor = literal;
  else next[property] = literal;
  return { target: next, detached: true, value: literal };
}
