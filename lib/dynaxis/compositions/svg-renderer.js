/**
 * Deterministic SVG renderer from Composition Document.
 * server-only (used by export; pure string building is testable via import in tests with allow-server-only)
 */

import 'server-only';
import {
  escapeSvgText,
  sortLayersForRender,
  textAnchorForAlign,
  textXForAlign,
} from './layout.js';
import { safeCssColor } from './colors.js';

/**
 * @param {import('zod').infer<typeof import('./document.js').compositionDocumentSchema>} doc
 * @param {Record<string, { dataUri: string, width?: number, height?: number }>} imageMap
 */
export function renderCompositionSvg(doc, imageMap = {}) {
  const { canvas, background, layers } = doc;
  const w = canvas.width;
  const h = canvas.height;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  );

  if (!canvas.transparent) {
    const bg = safeCssColor(canvas.backgroundColor, '#000000');
    parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);
  }

  if (background?.kind === 'color' && background.color) {
    parts.push(
      `<rect width="100%" height="100%" fill="${safeCssColor(background.color)}" opacity="${background.opacity ?? 1}"/>`
    );
  } else if (background?.kind === 'asset' && background.assetId) {
    const img = imageMap[background.assetId];
    if (img?.dataUri) {
      parts.push(
        `<image href="${img.dataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${
          background.fit === 'contain' ? 'xMidYMid meet' : background.fit === 'fill' ? 'none' : 'xMidYMid slice'
        }" opacity="${background.opacity ?? 1}"/>`
      );
    }
  }

  for (const layer of sortLayersForRender(layers.filter((l) => l.visible !== false))) {
    if (layer.type === 'image' && layer.assetId) {
      const img = imageMap[layer.assetId];
      if (!img?.dataUri) continue;
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      parts.push(
        `<g transform="translate(${cx},${cy}) rotate(${layer.rotation || 0}) translate(${-layer.width / 2},${-layer.height / 2})" opacity="${layer.opacity ?? 1}">` +
          `<image href="${img.dataUri}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${
            layer.fit === 'contain' ? 'xMidYMid meet' : layer.fit === 'fill' ? 'none' : 'xMidYMid slice'
          }"/>` +
          `</g>`
      );
      continue;
    }
    if (layer.type === 'text') {
      const align = layer.textAlign || 'left';
      const anchor = textAnchorForAlign(align);
      const tx = layer.x + textXForAlign(align, layer.width);
      const ty = layer.y + (layer.padding || 0) + (layer.fontSize || 16);
      const fill = safeCssColor(layer.color, '#ffffff');
      const fontWeight = layer.fontWeight ?? 400;
      const fontSize = layer.fontSize || 16;
      const fontFamily = escapeSvgText(layer.fontFamily || 'sans-serif');
      const lines = String(layer.text || '').split(/\n/);
      const lineHeight = (layer.lineHeight || 1.2) * fontSize;

      let group = `<g transform="translate(${layer.x},${layer.y}) rotate(${layer.rotation || 0})" opacity="${layer.opacity ?? 1}">`;
      if (layer.backgroundColor) {
        group += `<rect width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius || 0}" fill="${safeCssColor(layer.backgroundColor)}"/>`;
      }
      group += `<text x="${tx - layer.x}" y="${ty - layer.y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${layer.letterSpacing || 0}">`;
      lines.forEach((line, i) => {
        group += `<tspan x="${tx - layer.x}" dy="${i === 0 ? 0 : lineHeight}">${escapeSvgText(line)}</tspan>`;
      });
      group += `</text></g>`;
      parts.push(group);
    }
  }

  parts.push('</svg>');
  return parts.join('');
}
