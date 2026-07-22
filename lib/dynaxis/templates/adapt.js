/**
 * Deterministic multi-aspect Composition adaptation (client-safe).
 * Smart starting layout — not an AI designer / Figma Auto Layout.
 */

import { ADAPTATION_ENGINE_VERSION } from '../types.js';
import { parseCompositionDocument } from '../compositions/document.js';
import { getCampaignFormat } from '../campaigns/formats.js';
import { canvasDimensionsFromAspect } from '../compositions/initial-layout.js';

export { ADAPTATION_ENGINE_VERSION };

/**
 * Format guidance safe areas (design guidance, not hard render constraints).
 * @param {string | null | undefined} aspectRatio
 * @param {string | null | undefined} formatId
 */
export function safeAreaForFormat(aspectRatio, formatId) {
  const format = formatId ? getCampaignFormat(formatId) : null;
  const ar = aspectRatio || format?.aspectRatio || '1:1';
  // Story: bottom UI clearance; thumbnail: edge padding; default balanced
  if (ar === '9:16' || format?.format === 'story') {
    return { top: 64, right: 48, bottom: 160, left: 48 };
  }
  if (format?.format === 'thumbnail' || formatId === 'youtube_thumb') {
    return { top: 40, right: 40, bottom: 40, left: 40 };
  }
  if (ar === '16:9') {
    return { top: 48, right: 64, bottom: 48, left: 64 };
  }
  return { top: 48, right: 48, bottom: 80, left: 48 };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Map a point using horizontal/vertical anchors between canvases.
 */
function mapAnchoredPosition(layer, sourceCanvas, targetCanvas, scaleX, scaleY) {
  const hints = layer.adaptation || {};
  const hAnchor = hints.horizontalAnchor || 'left';
  const vAnchor = hints.verticalAnchor || 'top';
  const scaleBehaviour = hints.scaleBehaviour || 'proportional';

  let width =
    scaleBehaviour === 'fixed' ? layer.width : layer.width * scaleX;
  let height =
    scaleBehaviour === 'fixed' ? layer.height : layer.height * scaleY;

  if (hints.preserveAspectRatio !== false && (layer.type === 'image' || layer.type === 'component_instance')) {
    const s = Math.min(scaleX, scaleY);
    if (scaleBehaviour === 'proportional') {
      width = layer.width * s;
      height = layer.height * s;
    }
  }

  if (hints.minWidth) width = Math.max(width, hints.minWidth);
  if (hints.minHeight) height = Math.max(height, hints.minHeight);
  if (hints.maxWidth) width = Math.min(width, hints.maxWidth);
  if (hints.maxHeight) height = Math.min(height, hints.maxHeight);

  width = clamp(width, 8, targetCanvas.width);
  height = clamp(height, 8, targetCanvas.height);

  // Relative position within source
  const relX =
    hAnchor === 'right'
      ? (sourceCanvas.width - (layer.x + layer.width)) / sourceCanvas.width
      : hAnchor === 'centre'
        ? (layer.x + layer.width / 2) / sourceCanvas.width
        : layer.x / sourceCanvas.width;
  const relY =
    vAnchor === 'bottom'
      ? (sourceCanvas.height - (layer.y + layer.height)) / sourceCanvas.height
      : vAnchor === 'middle'
        ? (layer.y + layer.height / 2) / sourceCanvas.height
        : layer.y / sourceCanvas.height;

  let x;
  let y;
  if (hAnchor === 'right') {
    x = targetCanvas.width - relX * targetCanvas.width - width;
  } else if (hAnchor === 'centre') {
    x = relX * targetCanvas.width - width / 2;
  } else {
    x = relX * targetCanvas.width;
  }

  if (vAnchor === 'bottom') {
    y = targetCanvas.height - relY * targetCanvas.height - height;
  } else if (vAnchor === 'middle') {
    y = relY * targetCanvas.height - height / 2;
  } else {
    y = relY * targetCanvas.height;
  }

  return { x, y, width, height };
}

function applySafeAreaPadding(layer, canvas, safe, preference) {
  if (!safe || preference === 'ignore') return layer;
  const inset = {
    x: safe.left || 0,
    y: safe.top || 0,
    maxX: canvas.width - (safe.right || 0),
    maxY: canvas.height - (safe.bottom || 0),
  };
  let { x, y, width, height } = layer;
  if (x < inset.x) x = inset.x;
  if (y < inset.y) y = inset.y;
  if (x + width > inset.maxX) {
    if (preference === 'require') {
      width = Math.max(8, inset.maxX - x);
    } else {
      x = Math.max(inset.x, inset.maxX - width);
    }
  }
  if (y + height > inset.maxY) {
    if (preference === 'require') {
      height = Math.max(8, inset.maxY - y);
    } else {
      y = Math.max(inset.y, inset.maxY - height);
    }
  }
  return { ...layer, x, y, width, height };
}

/**
 * Adapt a Composition Document to a new canvas.
 * @param {unknown} documentInput
 * @param {{ width: number, height: number }} sourceCanvas
 * @param {{ width: number, height: number }} targetCanvas
 * @param {{ formatId?: string|null, omitDecorative?: boolean }} [rules]
 * @returns {{ document: object, warnings: object[], engineVersion: string }}
 */
export function adaptCompositionDocument(
  documentInput,
  sourceCanvas,
  targetCanvas,
  rules = {}
) {
  const source = parseCompositionDocument(documentInput);
  const scaleX = targetCanvas.width / sourceCanvas.width;
  const scaleY = targetCanvas.height / sourceCanvas.height;
  const safe = safeAreaForFormat(
    `${targetCanvas.width}:${targetCanvas.height}`,
    rules.formatId
  );
  // Prefer aspect from format if known
  const formatSafe = rules.formatId
    ? safeAreaForFormat(getCampaignFormat(rules.formatId)?.aspectRatio, rules.formatId)
    : safe;

  const warnings = [];
  const layers = [];

  for (const layer of source.layers) {
    const priority = layer.adaptation?.semanticPriority || inferPriority(layer);
    if (rules.omitDecorative && priority === 'decorative') {
      warnings.push({
        code: 'OPTIONAL_LAYER_OMITTED',
        layerId: layer.id,
        message: `Decorative layer omitted during adaptation`,
      });
      continue;
    }

    let next = {
      ...layer,
      ...mapAnchoredPosition(layer, sourceCanvas, targetCanvas, scaleX, scaleY),
    };

    if (layer.type === 'text') {
      const fontScale = Math.min(scaleX, scaleY);
      next = {
        ...next,
        fontSize: Math.max(8, Math.round(layer.fontSize * fontScale)),
      };
      // Rough overflow: if text length vs box width is aggressive
      const approxChars = Math.max(1, Math.floor(next.width / (next.fontSize * 0.5)));
      if (String(layer.text || '').length > approxChars * 3) {
        warnings.push({
          code: 'TEXT_OVERFLOW_RISK',
          layerId: layer.id,
          message: 'Text may overflow adapted text box',
        });
      }
    }

    if (layer.type === 'image') {
      const srcAspect = layer.width / layer.height;
      const dstAspect = next.width / next.height;
      if (Math.abs(srcAspect - dstAspect) > 0.05) {
        warnings.push({
          code: 'IMAGE_CROP_CHANGED',
          layerId: layer.id,
          message: 'Image frame aspect changed; crop may differ',
        });
      }
    }

    const pref = layer.adaptation?.safeAreaPreference || 'prefer';
    next = applySafeAreaPadding(next, targetCanvas, formatSafe, pref);

    // Clamp to canvas
    next.x = clamp(next.x, 0, Math.max(0, targetCanvas.width - 8));
    next.y = clamp(next.y, 0, Math.max(0, targetCanvas.height - 8));
    next.width = clamp(next.width, 8, targetCanvas.width - next.x);
    next.height = clamp(next.height, 8, targetCanvas.height - next.y);

    if (
      next.x < formatSafe.left ||
      next.y < formatSafe.top ||
      next.x + next.width > targetCanvas.width - formatSafe.right ||
      next.y + next.height > targetCanvas.height - formatSafe.bottom
    ) {
      warnings.push({
        code: 'LAYER_OUTSIDE_SAFE_AREA',
        layerId: layer.id,
        message: 'Layer intersects format safe-area guidance',
      });
    }

    layers.push(next);
  }

  // Collision detection (pairwise)
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      if (rectsOverlap(layers[i], layers[j])) {
        warnings.push({
          code: 'LAYER_COLLISION',
          layerId: layers[i].id,
          otherLayerId: layers[j].id,
          message: 'Adapted layers overlap',
        });
      }
    }
  }

  const document = parseCompositionDocument({
    version: 1,
    canvas: {
      width: targetCanvas.width,
      height: targetCanvas.height,
      backgroundColor: source.canvas.backgroundColor,
      transparent: source.canvas.transparent,
      safeArea: formatSafe,
    },
    background: source.background,
    layers,
    guides: source.guides ?? null,
    editorPrefs: source.editorPrefs ?? null,
  });

  return {
    document,
    warnings,
    engineVersion: ADAPTATION_ENGINE_VERSION,
  };
}

function inferPriority(layer) {
  if (layer.role === 'headline' || layer.role === 'cta' || layer.role === 'product') {
    return 'critical';
  }
  if (layer.role === 'body' || layer.role === 'brand_logo' || layer.role === 'character') {
    return 'primary';
  }
  if (layer.role === 'decorative') return 'decorative';
  return 'secondary';
}

/**
 * Resolve target canvas from format id or aspect ratio.
 * @param {{ formatId?: string, aspectRatio?: string, width?: number, height?: number, base?: number }} target
 */
export function resolveTargetCanvas(target = {}) {
  if (target.width && target.height) {
    return { width: target.width, height: target.height };
  }
  if (target.formatId) {
    const format = getCampaignFormat(target.formatId);
    if (format) return canvasDimensionsFromAspect(format.aspectRatio, target.base || 1080);
  }
  if (target.aspectRatio) {
    return canvasDimensionsFromAspect(target.aspectRatio, target.base || 1080);
  }
  return { width: 1080, height: 1080 };
}
