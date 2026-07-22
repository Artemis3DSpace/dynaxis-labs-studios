/**
 * Deterministic initial Campaign Deliverable layout (no LLM).
 */

import { COMPOSITION_DOCUMENT_VERSION } from '../types.js';
import { getCampaignFormat } from '../campaigns/formats.js';
import { positionFromPreset } from './layout.js';
import { safeCssColor } from './colors.js';

const DEFAULT_CANVAS = { width: 1080, height: 1080 };

/**
 * Parse aspect ratio string like "1:1" or "16:9" into pixel dimensions.
 * @param {string | null | undefined} aspectRatio
 * @param {number} [base]
 */
export function canvasDimensionsFromAspect(aspectRatio, base = 1080) {
  if (!aspectRatio || !aspectRatio.includes(':')) return { ...DEFAULT_CANVAS };
  const [w, h] = aspectRatio.split(':').map((n) => Number(n));
  if (!w || !h || w <= 0 || h <= 0) return { ...DEFAULT_CANVAS };
  if (w >= h) {
    return { width: base, height: Math.round((base * h) / w) };
  }
  return { width: Math.round((base * w) / h), height: base };
}

/**
 * Build initial Composition document from a Campaign Deliverable context.
 * @param {object} opts
 * @param {string} opts.formatId
 * @param {string} [opts.headline]
 * @param {string} [opts.body]
 * @param {string} [opts.cta]
 * @param {string} [opts.backgroundAssetId]
 * @param {string[]} [opts.brandColors]
 * @param {string[]} [opts.brandFonts]
 * @param {number} [opts.canvasWidth]
 * @param {number} [opts.canvasHeight]
 * @param {() => string} [opts.idFn]
 */
export function buildInitialDeliverableDocument(opts) {
  const newId =
    opts.idFn ||
    (() =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const format = getCampaignFormat(opts.formatId);
  const dims =
    opts.canvasWidth && opts.canvasHeight
      ? { width: opts.canvasWidth, height: opts.canvasHeight }
      : canvasDimensionsFromAspect(format?.aspectRatio);
  const safe = format?.aspectRatio
    ? { top: 48, right: 48, bottom: 80, left: 48 }
    : { top: 48, right: 48, bottom: 80, left: 48 };
  const brandColor = safeCssColor(opts.brandColors?.[0], '#ffffff');
  const font =
    opts.brandFonts?.[0] && /^[a-zA-Z0-9 ,.'"\-]+$/.test(opts.brandFonts[0])
      ? opts.brandFonts[0]
      : 'system-ui, sans-serif';

  const headlineBox = { width: Math.round(dims.width * 0.85), height: 120 };
  const bodyBox = { width: Math.round(dims.width * 0.8), height: 160 };
  const ctaBox = { width: 280, height: 56 };

  const headlinePos = positionFromPreset('top-left', dims, headlineBox, safe);
  const bodyPos = positionFromPreset('middle-left', dims, bodyBox, safe);
  const ctaPos = positionFromPreset('bottom-left', dims, ctaBox, safe);

  const layers = [];
  let z = 1;
  if (opts.headline) {
    layers.push({
      id: newId(),
      type: 'text',
      role: 'headline',
      name: 'Headline',
      text: opts.headline,
      ...headlinePos,
      ...headlineBox,
      zIndex: z++,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fontFamily: font,
      fontSize: Math.round(dims.width * 0.055),
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: 0,
      textAlign: 'left',
      color: brandColor,
      backgroundColor: null,
      padding: 8,
      borderRadius: 0,
    });
  }
  if (opts.body) {
    layers.push({
      id: newId(),
      type: 'text',
      role: 'body',
      name: 'Body',
      text: opts.body,
      ...bodyPos,
      ...bodyBox,
      zIndex: z++,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fontFamily: font,
      fontSize: Math.round(dims.width * 0.028),
      fontWeight: 400,
      lineHeight: 1.35,
      letterSpacing: 0,
      textAlign: 'left',
      color: brandColor,
      backgroundColor: null,
      padding: 8,
      borderRadius: 0,
    });
  }
  if (opts.cta) {
    layers.push({
      id: newId(),
      type: 'text',
      role: 'cta',
      name: 'CTA',
      text: opts.cta,
      ...ctaPos,
      ...ctaBox,
      zIndex: z++,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fontFamily: font,
      fontSize: Math.round(dims.width * 0.032),
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: 12,
      borderRadius: 28,
    });
  }

  return {
    version: COMPOSITION_DOCUMENT_VERSION,
    canvas: {
      width: dims.width,
      height: dims.height,
      backgroundColor: null,
      transparent: false,
      safeArea: safe,
    },
    background: opts.backgroundAssetId
      ? {
          kind: 'asset',
          assetId: opts.backgroundAssetId,
          fit: 'cover',
          position: 'middle-center',
          opacity: 1,
        }
      : {
          kind: 'color',
          color: '#1a1a1a',
          fit: 'cover',
          position: 'middle-center',
          opacity: 1,
        },
    layers,
    guides: null,
    editorPrefs: null,
  };
}

/**
 * Empty document for generic Asset editing.
 * @param {object} opts
 * @param {string} opts.backgroundAssetId
 * @param {number} opts.width
 * @param {number} opts.height
 */
export function buildInitialAssetDocument(opts) {
  return {
    version: COMPOSITION_DOCUMENT_VERSION,
    canvas: {
      width: opts.width,
      height: opts.height,
      backgroundColor: null,
      transparent: false,
      safeArea: { top: 32, right: 32, bottom: 32, left: 32 },
    },
    background: {
      kind: 'asset',
      assetId: opts.backgroundAssetId,
      fit: 'cover',
      position: 'middle-center',
      opacity: 1,
    },
    layers: [],
    guides: null,
    editorPrefs: null,
  };
}
