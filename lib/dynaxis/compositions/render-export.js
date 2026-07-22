/**
 * Composition PNG export via Resvg (server-only).
 *
 * Token bindings and Component expansion must be applied by callers
 * (see resolveCompositionTokens + expandCompositionDocument in compositions service)
 * before invoking this rasterizer. Pass an already-resolved document.
 */

import 'server-only';
import { renderCompositionSvg } from './svg-renderer.js';
import { parseCompositionDocument, collectDocumentAssetIds } from './document.js';
import { bytesToDataUri, resolveAssetImageBytes } from './asset-fetch.js';
import { COMPOSITION_RENDER_VERSION } from '../types.js';
import { applyTokenBindingsToDocument } from '../design-systems/bindings.js';

/**
 * @param {object} opts
 * @param {object} opts.document
 * @param {Record<string, object>} opts.assetsById — id → asset row
 * @param {unknown} [opts.tokenDocument] — optional; applied before rasterize if provided
 * @param {Record<string, string>} [opts.modesByCollection]
 * @param {boolean} [opts.rejectUnresolvedTokens]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(svg: string, w: number, h: number) => Promise<Buffer>} [opts.rasterizeFn]
 */
export async function renderCompositionPng(opts) {
  let docInput = opts.document;
  if (opts.tokenDocument) {
    const { document: bound, errors } = applyTokenBindingsToDocument(
      docInput,
      opts.tokenDocument,
      {
        modesByCollection: opts.modesByCollection || {},
        rejectUnresolved: Boolean(opts.rejectUnresolvedTokens),
      }
    );
    if (opts.rejectUnresolvedTokens && errors.length) {
      const first = errors[0];
      throw Object.assign(new Error(first.message), first);
    }
    docInput = bound;
  }
  const doc = parseCompositionDocument(docInput);
  const assetIds = collectDocumentAssetIds(doc);
  const imageMap = {};

  for (const id of assetIds) {
    const asset = opts.assetsById[id];
    if (!asset) {
      const e = new Error(`Missing asset for layer: ${id}`);
      e.code = 'COMPOSITION_ASSET_NOT_FOUND';
      e.status = 404;
      throw e;
    }
    const { bytes, mimeType } = await resolveAssetImageBytes(asset, {
      fetchImpl: opts.fetchImpl,
    });
    imageMap[id] = { dataUri: bytesToDataUri(bytes, mimeType) };
  }

  const svg = renderCompositionSvg(doc, imageMap);
  const w = doc.canvas.width;
  const h = doc.canvas.height;

  const rasterize =
    opts.rasterizeFn ||
    (async (svgStr, width, height) => {
      const { Resvg } = await import('@resvg/resvg-js');
      const resvg = new Resvg(svgStr, {
        fitTo: { mode: 'width', value: width },
        background: doc.canvas.transparent ? 'transparent' : undefined,
      });
      const rendered = resvg.render();
      return Buffer.from(rendered.asPng());
    });

  const png = await rasterize(svg, w, h);
  return {
    png,
    svg,
    width: w,
    height: h,
    renderVersion: COMPOSITION_RENDER_VERSION,
  };
}

/**
 * Register rendered PNG as data-URL — LEGACY only for unit fixtures.
 * Production export must use Asset Blob Store (see storage/register-rendered.js).
 * @param {Buffer} png
 * @deprecated Do not use for Composition export persistence.
 */
export function pngToDataUrl(png) {
  return `data:image/png;base64,${png.toString('base64')}`;
}
