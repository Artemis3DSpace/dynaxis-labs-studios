/**
 * Colour normalization for Composition documents (client-safe).
 */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function normalizeHexColor(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.toLowerCase() === 'transparent') return 'transparent';
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) {
    const [, h] = s.match(/^#(.)(.)(.)$/) || [];
    if (!h) return null;
    const [r, g, b] = s.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function safeCssColor(raw, fallback = '#000000') {
  return normalizeHexColor(raw) || fallback;
}
