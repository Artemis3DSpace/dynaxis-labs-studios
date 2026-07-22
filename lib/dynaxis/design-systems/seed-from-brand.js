/**
 * Seed a Design Token Document from Brand visual context (COPY — not live sync).
 */

import { parseDesignTokenDocument, DESIGN_TOKEN_DOCUMENT_VERSION } from './document.js';
import { normalizeHexColor } from '../compositions/colors.js';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @param {{
 *   primaryColors?: string[],
 *   secondaryColors?: string[],
 *   fonts?: string[],
 * }} visual
 * @param {{ lightModeName?: string, darkModeName?: string }} [opts]
 */
export function seedTokenDocumentFromBrandVisual(visual = {}, opts = {}) {
  const colourCollectionId = newId();
  const typeCollectionId = newId();
  const lightModeId = newId();
  const darkModeId = newId();
  const typeDefaultModeId = newId();

  const primary = (visual.primaryColors || [])
    .map((c) => normalizeHexColor(c))
    .filter(Boolean);
  const secondary = (visual.secondaryColors || [])
    .map((c) => normalizeHexColor(c))
    .filter(Boolean);
  const fonts = (visual.fonts || []).filter(Boolean);

  const tokens = [];
  const primitiveIds = [];

  primary.forEach((color, i) => {
    const id = newId();
    primitiveIds.push(id);
    tokens.push({
      id,
      name: `brand.primary.${i + 1}`,
      type: 'colour',
      collectionId: colourCollectionId,
      group: 'primary',
      defaultValue: color,
      valuesByMode: {
        [lightModeId]: color,
        [darkModeId]: color,
      },
      description: 'Seeded from Brand primary colour',
    });
  });

  secondary.forEach((color, i) => {
    const id = newId();
    tokens.push({
      id,
      name: `brand.secondary.${i + 1}`,
      type: 'colour',
      collectionId: colourCollectionId,
      group: 'secondary',
      defaultValue: color,
      valuesByMode: {
        [lightModeId]: color,
        [darkModeId]: color,
      },
      description: 'Seeded from Brand secondary colour',
    });
  });

  if (primitiveIds[0]) {
    tokens.push({
      id: newId(),
      name: 'action.primary',
      type: 'colour',
      collectionId: colourCollectionId,
      group: 'primary',
      aliasOf: primitiveIds[0],
      description: 'Semantic primary action — aliases Brand primary',
    });
    tokens.push({
      id: newId(),
      name: 'text.primary',
      type: 'colour',
      collectionId: colourCollectionId,
      group: 'text',
      defaultValue: '#111111',
      valuesByMode: {
        [lightModeId]: '#111111',
        [darkModeId]: '#f5f5f5',
      },
      description: 'Semantic primary text',
    });
    tokens.push({
      id: newId(),
      name: 'surface.default',
      type: 'colour',
      collectionId: colourCollectionId,
      group: 'surface',
      defaultValue: '#ffffff',
      valuesByMode: {
        [lightModeId]: '#ffffff',
        [darkModeId]: '#121212',
      },
      description: 'Semantic surface',
    });
  }

  if (fonts[0]) {
    tokens.push({
      id: newId(),
      name: 'typography.font.primary',
      type: 'string',
      collectionId: typeCollectionId,
      group: 'font family',
      defaultValue: fonts[0],
      description: 'Seeded from Brand font metadata',
    });
  }

  return parseDesignTokenDocument({
    version: DESIGN_TOKEN_DOCUMENT_VERSION,
    collections: [
      {
        id: colourCollectionId,
        name: 'Colours',
        description: 'Brand-seeded colour tokens',
        modes: [
          { id: lightModeId, name: opts.lightModeName || 'Light' },
          { id: darkModeId, name: opts.darkModeName || 'Dark' },
        ],
        defaultModeId: lightModeId,
        groupHints: ['primary', 'secondary', 'text', 'surface'],
      },
      {
        id: typeCollectionId,
        name: 'Typography',
        description: 'Brand-seeded typography tokens',
        modes: [{ id: typeDefaultModeId, name: 'Default' }],
        defaultModeId: typeDefaultModeId,
        groupHints: ['font family'],
      },
    ],
    tokens,
    metadata: {
      seededFromBrand: true,
      seedVersion: 1,
    },
  });
}
