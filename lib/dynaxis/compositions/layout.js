/**
 * Shared layout calculations for client preview and server SVG export (client-safe).
 */

import { POSITION_PRESETS } from './document.js';

/**
 * Map nine-position preset to top-left x/y within a container.
 * @param {typeof POSITION_PRESETS[number]} preset
 * @param {{ width: number, height: number }} container
 * @param {{ width: number, height: number }} item
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} [inset]
 */
export function positionFromPreset(preset, container, item, inset = {}) {
  const pad = {
    top: inset.top || 0,
    right: inset.right || 0,
    bottom: inset.bottom || 0,
    left: inset.left || 0,
  };
  const innerW = container.width - pad.left - pad.right;
  const innerH = container.height - pad.top - pad.bottom;
  const [v, h] = preset.split('-');
  let x = pad.left;
  let y = pad.top;
  if (h === 'center') x += (innerW - item.width) / 2;
  else if (h === 'right') x += innerW - item.width;
  if (v === 'middle') y += (innerH - item.height) / 2;
  else if (v === 'bottom') y += innerH - item.height;
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Clamp layer box inside canvas bounds.
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {{ width: number, height: number }} canvas
 */
export function clampLayerToCanvas(box, canvas) {
  const width = Math.min(box.width, canvas.width);
  const height = Math.min(box.height, canvas.height);
  const x = Math.max(0, Math.min(box.x, canvas.width - width));
  const y = Math.max(0, Math.min(box.y, canvas.height - height));
  return { x, y, width, height };
}

/**
 * Nudge layer position by delta (arrow keys).
 * @param {{ x: number, y: number }} pos
 * @param {{ dx: number, dy: number }} delta
 * @param {{ width: number, height: number }} layer
 * @param {{ width: number, height: number }} canvas
 */
export function nudgeLayer(pos, delta, layer, canvas) {
  return clampLayerToCanvas(
    {
      x: pos.x + delta.dx,
      y: pos.y + delta.dy,
      width: layer.width,
      height: layer.height,
    },
    canvas
  );
}

/**
 * Sort layers by zIndex ascending for render order.
 * @param {Array<{ zIndex: number, id: string }>} layers
 */
export function sortLayersForRender(layers) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

/**
 * Escape text for SVG text nodes (not HTML).
 * @param {string} text
 */
export function escapeSvgText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Map text-align to SVG text-anchor.
 * @param {'left'|'center'|'right'} align
 */
export function textAnchorForAlign(align) {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

/**
 * Compute text x offset for alignment within layer box.
 * @param {'left'|'center'|'right'} align
 * @param {number} width
 */
export function textXForAlign(align, width) {
  if (align === 'center') return width / 2;
  if (align === 'right') return width;
  return 0;
}

/**
 * Duplicate a layer with new id.
 * @param {object} layer
 * @param {() => string} idFn
 */
export function duplicateLayer(layer, idFn) {
  return {
    ...JSON.parse(JSON.stringify(layer)),
    id: idFn(),
    x: layer.x + 12,
    y: layer.y + 12,
    zIndex: layer.zIndex + 1,
  };
}
