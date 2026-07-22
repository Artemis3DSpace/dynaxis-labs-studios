/**
 * Composition consumer — client-safe Brand visual hints for editor.
 */

/**
 * @param {object | null | undefined} brandVisual
 * @returns {{ palette: string[], fonts: string[] }}
 */
export function compositionBrandHints(brandVisual) {
  const palette = [];
  for (const c of brandVisual?.primaryColors || []) {
    const n = String(c || '').trim();
    if (n) palette.push(n);
  }
  for (const c of brandVisual?.secondaryColors || []) {
    const n = String(c || '').trim();
    if (n) palette.push(n);
  }
  const fonts = (brandVisual?.fonts || [])
    .map((f) => (typeof f === 'string' ? f : f?.family || f?.name || ''))
    .filter(Boolean);
  return { palette, fonts };
}
