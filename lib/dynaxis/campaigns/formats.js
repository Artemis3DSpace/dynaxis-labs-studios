/**
 * Dynaxis Campaign format registry (adapted from Open Pomelli platforms.ts).
 * Creative specifications only — not publishing accounts.
 * Typed code config — not stored in the database.
 */

export const CAMPAIGN_FORMATS = /** @type {const} */ ([
  {
    id: 'instagram_square',
    platform: 'instagram',
    format: 'square',
    label: 'Instagram — Feed (1:1)',
    aspectRatio: '1:1',
    headlineMaxWords: 8,
    bodyMaxWords: 25,
    ctaMaxWords: 3,
    copyTone: 'casual, scroll-stopping, lower-case',
    imageComposition:
      'Bold focal subject, mobile-thumb readable, generous safe area for text, social-feed scroll-stopping.',
    outputModality: 'image',
  },
  {
    id: 'instagram_story',
    platform: 'instagram',
    format: 'story',
    label: 'Instagram — Story (9:16)',
    aspectRatio: '9:16',
    headlineMaxWords: 6,
    bodyMaxWords: 0,
    ctaMaxWords: 3,
    copyTone: 'punchy, single-line hook',
    imageComposition:
      'Vertical composition, primary subject upper-third, bottom 20% reserved for app UI, vivid lighting.',
    outputModality: 'image',
  },
  {
    id: 'linkedin_post',
    platform: 'linkedin',
    format: 'post',
    label: 'LinkedIn — Feed (1:1)',
    aspectRatio: '1:1',
    headlineMaxWords: 10,
    bodyMaxWords: 35,
    ctaMaxWords: 3,
    copyTone: 'professional, declarative, no hashtags in copy',
    imageComposition:
      'Editorial, polished, subtle gradient or clean photography, professional palette emphasis.',
    outputModality: 'image',
  },
  {
    id: 'facebook_ad',
    platform: 'facebook',
    format: 'ad',
    label: 'Facebook — Feed Ad (1:1)',
    aspectRatio: '1:1',
    headlineMaxWords: 7,
    bodyMaxWords: 25,
    ctaMaxWords: 3,
    copyTone: 'benefit-led, conversational, direct',
    imageComposition:
      'Single clear value prop visual, high-contrast subject, minimal text-in-image.',
    outputModality: 'image',
  },
  {
    id: 'twitter_post',
    platform: 'twitter',
    format: 'post',
    label: 'X / Twitter — Post (16:9)',
    aspectRatio: '16:9',
    headlineMaxWords: 6,
    bodyMaxWords: 30,
    ctaMaxWords: 3,
    copyTone: 'sharp, opinionated, one-liner energy',
    imageComposition:
      'Wide cinematic crop, single focal element, readable on mobile timeline at small size.',
    outputModality: 'image',
  },
  {
    id: 'web_banner',
    platform: 'web',
    format: 'banner',
    label: 'Web — Hero Banner (16:9)',
    aspectRatio: '16:9',
    headlineMaxWords: 6,
    bodyMaxWords: 20,
    ctaMaxWords: 3,
    copyTone: 'confident, brand-led, marketing-site voice',
    imageComposition:
      'Cinematic hero composition, breathing room for overlaid headline, palette-led background.',
    outputModality: 'image',
  },
  {
    id: 'email_banner',
    platform: 'email',
    format: 'header',
    label: 'Email — Header (16:9)',
    aspectRatio: '16:9',
    headlineMaxWords: 7,
    bodyMaxWords: 20,
    ctaMaxWords: 3,
    copyTone: 'warm, direct, like a subject line',
    imageComposition:
      'Clean horizontal banner, subject framed left or right with negative space for headline overlay.',
    outputModality: 'image',
  },
  {
    id: 'youtube_thumb',
    platform: 'youtube',
    format: 'thumbnail',
    label: 'YouTube — Thumbnail (16:9)',
    aspectRatio: '16:9',
    headlineMaxWords: 5,
    bodyMaxWords: 0,
    ctaMaxWords: 0,
    copyTone: 'ultra-bold curiosity hook, all-caps energy',
    imageComposition:
      'High-contrast face or single object, oversized bold text overlay (3-5 words), saturated palette, click-worthy.',
    outputModality: 'image',
  },
]);

/** @typedef {(typeof CAMPAIGN_FORMATS)[number]} CampaignFormatSpec */
/** @typedef {CampaignFormatSpec['id']} CampaignFormatId */

export const CAMPAIGN_FORMAT_IDS = CAMPAIGN_FORMATS.map((f) => f.id);

/**
 * @param {string} id
 * @returns {CampaignFormatSpec|null}
 */
export function getCampaignFormat(id) {
  return (
    CAMPAIGN_FORMATS.find((f) => f.id === id) ||
    null
  );
}

/**
 * @param {string} id
 */
export function isCampaignFormatId(id) {
  return CAMPAIGN_FORMAT_IDS.includes(/** @type {CampaignFormatId} */ (id));
}

/**
 * Map LLM recommended platform tokens to format IDs.
 * @param {string[]} tokens
 * @returns {string[]}
 */
export function mapRecommendedFormatIds(tokens = []) {
  const out = [];
  const seen = new Set();
  for (const raw of tokens) {
    const t = String(raw || '')
      .trim()
      .toLowerCase();
    if (!t) continue;
    const direct = getCampaignFormat(t);
    if (direct && !seen.has(direct.id)) {
      seen.add(direct.id);
      out.push(direct.id);
      continue;
    }
    for (const f of CAMPAIGN_FORMATS) {
      if (
        (f.platform === t || f.format === t || f.id.startsWith(`${t}_`)) &&
        !seen.has(f.id)
      ) {
        seen.add(f.id);
        out.push(f.id);
      }
    }
  }
  return out;
}

/**
 * Count words in a string (whitespace-separated).
 * @param {string} text
 */
export function countWords(text) {
  const s = String(text || '').trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Validate copy against format word limits.
 * @param {CampaignFormatSpec} format
 * @param {{ headline?: string, body?: string, cta?: string }} copy
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFormatCopy(format, copy = {}) {
  const errors = [];
  const headline = String(copy.headline || '').trim();
  const body = String(copy.body || '').trim();
  const cta = String(copy.cta || '').trim();

  if (format.headlineMaxWords === 0) {
    if (headline) errors.push('headline must be empty for this format');
  } else if (!headline) {
    errors.push('headline is required');
  } else if (countWords(headline) > format.headlineMaxWords) {
    errors.push(
      `headline exceeds ${format.headlineMaxWords} words (got ${countWords(headline)})`
    );
  }

  if (format.bodyMaxWords === 0) {
    if (body) errors.push('body must be empty for this format');
  } else if (body && countWords(body) > format.bodyMaxWords) {
    errors.push(
      `body exceeds ${format.bodyMaxWords} words (got ${countWords(body)})`
    );
  }

  if (format.ctaMaxWords === 0) {
    if (cta) errors.push('cta must be empty for this format');
  } else if (cta && countWords(cta) > format.ctaMaxWords) {
    errors.push(
      `cta exceeds ${format.ctaMaxWords} words (got ${countWords(cta)})`
    );
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Truncate to max words (last resort after failed repair).
 * @param {string} text
 * @param {number} maxWords
 */
export function truncateToMaxWords(text, maxWords) {
  if (maxWords <= 0) return '';
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}
