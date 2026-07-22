/**
 * Deterministic CSS colour normalisation (adapted from Open Pomelli colors.ts, MIT).
 * Pure / shared — no server deps.
 */

/**
 * @param {string} c
 * @returns {string|null}
 */
export function rgbToHex(c) {
  if (!c || typeof c !== 'string') return null;
  const raw = c.trim().toLowerCase();
  if (raw.startsWith('#')) {
    if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
    if (/^#[0-9a-f]{3}$/.test(raw)) {
      return `#${raw
        .slice(1)
        .split('')
        .map((x) => x + x)
        .join('')}`;
    }
    return null;
  }
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if ([r, g, b].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return (
    '#' +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * @param {string[]} rawColors
 * @returns {{ primary: string[], secondary: string[] }}
 */
export function pickPalette(rawColors = []) {
  const counts = new Map();
  for (const raw of rawColors) {
    const hex = rgbToHex(raw);
    if (!hex) continue;
    if (hex === '#ffffff' || hex === '#000000') continue;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);
  return {
    primary: sorted.slice(0, 3),
    secondary: sorted.slice(3, 8),
  };
}

/**
 * @param {...string[]} lists
 * @returns {string[]}
 */
export function dedupeColors(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const c of list || []) {
      const hex = rgbToHex(String(c));
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      out.push(hex);
    }
  }
  return out;
}

/**
 * @param {string[]} fonts
 * @returns {string[]}
 */
export function normalizeFonts(fonts = []) {
  const out = [];
  const seen = new Set();
  for (const f of fonts) {
    const name = String(f || '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (!name || name.length > 200) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (['inherit', 'initial', 'unset', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(key)) {
      continue;
    }
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 20);
}
