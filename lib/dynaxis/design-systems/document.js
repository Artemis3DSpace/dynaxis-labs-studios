/**
 * Dynaxis Design Token Document — versioned Zod schema (client-safe).
 *
 * Structured platform tokens — not CSS variables as the canonical model.
 * Modes switch values; they are not responsive layout / media queries.
 */

import { z } from 'zod';
import {
  DESIGN_TOKEN_DOCUMENT_VERSION,
  DESIGN_TOKEN_PRIMITIVE_TYPES,
} from '../types.js';
import { normalizeHexColor } from '../compositions/colors.js';

const hexColorSchema = z
  .string()
  .trim()
  .refine((v) => normalizeHexColor(v) != null, 'invalid colour');

export const designTokenModeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export const designTokenCollectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  /** Modes supported by this collection (at least one). */
  modes: z.array(designTokenModeSchema).min(1).max(24),
  defaultModeId: z.string().uuid(),
  groupHints: z.array(z.string().trim().max(64)).max(24).optional().nullable(),
});

const literalValueSchema = z.union([
  z.string().max(8000),
  z.number().finite(),
  z.boolean(),
]);

export const designTokenSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().nullable(),
    type: z.enum(DESIGN_TOKEN_PRIMITIVE_TYPES),
    collectionId: z.string().uuid(),
    group: z.string().trim().max(64).optional().nullable(),
    /** Literal base/default value used when a mode has no explicit value and no alias. */
    defaultValue: literalValueSchema.optional().nullable(),
    /** Per-mode literal values keyed by mode ID. */
    valuesByMode: z.record(z.string().uuid(), literalValueSchema).optional().nullable(),
    /** Alias to another token ID (same type). Prefer over copying primitives. */
    aliasOf: z.string().uuid().optional().nullable(),
  })
  .superRefine((token, ctx) => {
    if (token.aliasOf && token.aliasOf === token.id) {
      ctx.addIssue({
        code: 'custom',
        message: 'token cannot alias itself',
        path: ['aliasOf'],
      });
    }
    if (token.type === 'colour' && token.defaultValue != null && typeof token.defaultValue === 'string') {
      if (normalizeHexColor(token.defaultValue) == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'colour defaultValue must be a valid colour',
          path: ['defaultValue'],
        });
      }
    }
    if (token.valuesByMode) {
      for (const [modeId, val] of Object.entries(token.valuesByMode)) {
        if (token.type === 'colour' && typeof val === 'string' && normalizeHexColor(val) == null) {
          ctx.addIssue({
            code: 'custom',
            message: `invalid colour for mode ${modeId}`,
            path: ['valuesByMode', modeId],
          });
        }
        if (token.type === 'number' && typeof val !== 'number') {
          ctx.addIssue({
            code: 'custom',
            message: `number token mode value must be number`,
            path: ['valuesByMode', modeId],
          });
        }
        if (token.type === 'boolean' && typeof val !== 'boolean') {
          ctx.addIssue({
            code: 'custom',
            message: `boolean token mode value must be boolean`,
            path: ['valuesByMode', modeId],
          });
        }
        if (token.type === 'string' && typeof val !== 'string') {
          ctx.addIssue({
            code: 'custom',
            message: `string token mode value must be string`,
            path: ['valuesByMode', modeId],
          });
        }
      }
    }
    if (!token.aliasOf && token.defaultValue == null && !token.valuesByMode) {
      ctx.addIssue({
        code: 'custom',
        message: 'token requires defaultValue, valuesByMode, or aliasOf',
      });
    }
  });

export const designTokenDocumentSchema = z
  .object({
    version: z.literal(DESIGN_TOKEN_DOCUMENT_VERSION),
    collections: z.array(designTokenCollectionSchema).max(48).default([]),
    tokens: z.array(designTokenSchema).max(512).default([]),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((doc, ctx) => {
    const collectionIds = new Set();
    const modeIds = new Set();
    for (const col of doc.collections) {
      if (collectionIds.has(col.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate collection id: ${col.id}` });
      }
      collectionIds.add(col.id);
      const colModes = new Set();
      for (const mode of col.modes) {
        if (colModes.has(mode.id) || modeIds.has(mode.id)) {
          ctx.addIssue({ code: 'custom', message: `duplicate mode id: ${mode.id}` });
        }
        colModes.add(mode.id);
        modeIds.add(mode.id);
      }
      if (!colModes.has(col.defaultModeId)) {
        ctx.addIssue({
          code: 'custom',
          message: `collection defaultModeId not in modes: ${col.defaultModeId}`,
        });
      }
    }

    const tokenIds = new Set();
    for (const token of doc.tokens) {
      if (tokenIds.has(token.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate token id: ${token.id}` });
      }
      tokenIds.add(token.id);
      if (!collectionIds.has(token.collectionId)) {
        ctx.addIssue({
          code: 'custom',
          message: `token collection missing: ${token.collectionId}`,
        });
      }
      if (token.valuesByMode) {
        for (const modeId of Object.keys(token.valuesByMode)) {
          if (!modeIds.has(modeId)) {
            ctx.addIssue({
              code: 'custom',
              message: `token mode unknown: ${modeId}`,
              path: ['tokens'],
            });
          }
        }
      }
    }

    for (const token of doc.tokens) {
      if (!token.aliasOf) continue;
      if (!tokenIds.has(token.aliasOf)) {
        ctx.addIssue({
          code: 'custom',
          message: `alias target missing: ${token.aliasOf}`,
        });
        continue;
      }
      const target = doc.tokens.find((t) => t.id === token.aliasOf);
      if (target && target.type !== token.type) {
        ctx.addIssue({
          code: 'custom',
          message: `alias type mismatch: ${token.type} → ${target.type}`,
        });
      }
    }

    // Cycle detection at parse time
    const byId = new Map(doc.tokens.map((t) => [t.id, t]));
    for (const token of doc.tokens) {
      if (!token.aliasOf) continue;
      const seen = new Set();
      let cur = token;
      while (cur?.aliasOf) {
        if (seen.has(cur.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `DESIGN_TOKEN_ALIAS_CYCLE involving ${token.id}`,
          });
          break;
        }
        seen.add(cur.id);
        cur = byId.get(cur.aliasOf);
        if (!cur) break;
      }
    }
  });

/**
 * @param {unknown} input
 */
export function parseDesignTokenDocument(input) {
  return designTokenDocumentSchema.parse(input);
}

export function emptyDesignTokenDocument() {
  return parseDesignTokenDocument({
    version: DESIGN_TOKEN_DOCUMENT_VERSION,
    collections: [],
    tokens: [],
    metadata: null,
  });
}

export { DESIGN_TOKEN_DOCUMENT_VERSION, DESIGN_TOKEN_PRIMITIVE_TYPES };
