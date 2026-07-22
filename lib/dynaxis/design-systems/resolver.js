/**
 * Pure Design Token resolver (client-safe).
 * No database access.
 */

import { parseDesignTokenDocument } from './document.js';
import { normalizeHexColor } from '../compositions/colors.js';

/**
 * @param {unknown} tokenDocumentInput
 * @param {string} tokenId
 * @param {{ modesByCollection?: Record<string, string>, modeId?: string|null }} [modeContext]
 * @returns {{
 *   tokenId: string,
 *   type: string,
 *   value: string|number|boolean,
 *   source: 'mode'|'default'|'alias',
 *   warnings: object[],
 *   chain: string[],
 * }}
 */
export function resolveDesignToken(tokenDocumentInput, tokenId, modeContext = {}) {
  const doc = parseDesignTokenDocument(tokenDocumentInput);
  const byId = new Map(doc.tokens.map((t) => [t.id, t]));
  const collections = new Map(doc.collections.map((c) => [c.id, c]));
  const warnings = [];
  const chain = [];

  let currentId = tokenId;
  const seen = new Set();

  while (true) {
    if (seen.has(currentId)) {
      const err = new Error(`Token alias cycle involving ${tokenId}`);
      err.code = 'DESIGN_TOKEN_ALIAS_CYCLE';
      err.chain = [...seen, currentId];
      throw err;
    }
    seen.add(currentId);
    chain.push(currentId);

    const token = byId.get(currentId);
    if (!token) {
      const err = new Error(`Token not found: ${currentId}`);
      err.code = 'DESIGN_TOKEN_NOT_FOUND';
      throw err;
    }

    if (token.aliasOf) {
      const target = byId.get(token.aliasOf);
      if (!target) {
        const err = new Error(`Alias target missing: ${token.aliasOf}`);
        err.code = 'DESIGN_TOKEN_ALIAS_MISSING';
        throw err;
      }
      if (target.type !== token.type) {
        const err = new Error(`Alias type mismatch: ${token.type} → ${target.type}`);
        err.code = 'DESIGN_TOKEN_ALIAS_TYPE_MISMATCH';
        throw err;
      }
      currentId = token.aliasOf;
      continue;
    }

    const collection = collections.get(token.collectionId);
    const requestedMode =
      modeContext.modeId ||
      modeContext.modesByCollection?.[token.collectionId] ||
      null;
    const defaultModeId = collection?.defaultModeId || null;

    let value;
    let source;

    if (requestedMode && token.valuesByMode?.[requestedMode] != null) {
      value = token.valuesByMode[requestedMode];
      source = 'mode';
    } else if (requestedMode && defaultModeId && token.valuesByMode?.[defaultModeId] != null) {
      value = token.valuesByMode[defaultModeId];
      source = 'default';
      warnings.push({
        code: 'DESIGN_TOKEN_MODE_FALLBACK',
        message: `Mode ${requestedMode} missing for token ${token.id}; used collection default`,
        tokenId: token.id,
        requestedMode,
        fallbackMode: defaultModeId,
      });
    } else if (token.defaultValue != null) {
      value = token.defaultValue;
      source = 'default';
      if (requestedMode) {
        warnings.push({
          code: 'DESIGN_TOKEN_MODE_FALLBACK',
          message: `Mode ${requestedMode} missing for token ${token.id}; used defaultValue`,
          tokenId: token.id,
          requestedMode,
        });
      }
    } else if (defaultModeId && token.valuesByMode?.[defaultModeId] != null) {
      value = token.valuesByMode[defaultModeId];
      source = 'default';
    } else {
      const err = new Error(`Token has no resolvable value: ${token.id}`);
      err.code = 'DESIGN_TOKEN_VALUE_MISSING';
      throw err;
    }

    if (token.type === 'colour') {
      const color = normalizeHexColor(String(value));
      if (!color) {
        const err = new Error(`Resolved colour invalid for token ${token.id}`);
        err.code = 'DESIGN_TOKEN_VALUE_INVALID';
        throw err;
      }
      value = color;
    }

    return {
      tokenId: token.id,
      type: token.type,
      value,
      source,
      warnings,
      chain,
      name: token.name,
      group: token.group || null,
      collectionId: token.collectionId,
    };
  }
}

/**
 * Resolve many tokens for a mode context.
 * @param {unknown} tokenDocumentInput
 * @param {string[]} tokenIds
 * @param {object} [modeContext]
 */
export function resolveDesignTokens(tokenDocumentInput, tokenIds, modeContext = {}) {
  const results = {};
  const warnings = [];
  const errors = [];
  for (const id of tokenIds || []) {
    try {
      const resolved = resolveDesignToken(tokenDocumentInput, id, modeContext);
      results[id] = resolved;
      warnings.push(...(resolved.warnings || []));
    } catch (err) {
      errors.push({ tokenId: id, code: err.code || 'DESIGN_TOKEN_RESOLVE_FAILED', message: err.message });
    }
  }
  return { results, warnings, errors };
}

/**
 * Evaluate Design System revision update for token bindings.
 * @param {unknown} fromDoc
 * @param {unknown} toDoc
 * @param {string[]} usedTokenIds
 */
export function evaluateDesignSystemRevisionUpdate(fromDoc, toDoc, usedTokenIds = []) {
  const from = parseDesignTokenDocument(fromDoc);
  const to = parseDesignTokenDocument(toDoc);
  const toById = new Map(to.tokens.map((t) => [t.id, t]));
  const fromById = new Map(from.tokens.map((t) => [t.id, t]));
  const compatible = [];
  const incompatible = [];
  const warnings = [];

  for (const id of usedTokenIds) {
    const next = toById.get(id);
    const prev = fromById.get(id);
    if (!next) {
      incompatible.push({
        tokenId: id,
        code: 'DESIGN_TOKEN_BINDING_CONFLICT',
        message: `token ${id} removed in target revision`,
      });
      continue;
    }
    if (prev && next.type !== prev.type) {
      incompatible.push({
        tokenId: id,
        code: 'DESIGN_TOKEN_BINDING_CONFLICT',
        message: `token ${id} type changed (${prev.type} → ${next.type})`,
      });
      continue;
    }
    if (prev && next.name !== prev.name) {
      warnings.push({
        tokenId: id,
        code: 'DESIGN_TOKEN_RENAMED',
        message: `token display name changed (${prev.name} → ${next.name})`,
      });
    }
    compatible.push(id);
  }

  return { compatible, incompatible, warnings };
}
