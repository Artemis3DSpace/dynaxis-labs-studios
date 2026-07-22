/**
 * Deterministic Campaign reference Asset ordering and limits.
 */

export const CAMPAIGN_MAX_REFERENCE_IMAGES = 8;

/**
 * @param {{
 *   productRefs?: Array<{ assetId?: string, url?: string, role?: string }>,
 *   characterRefs?: Array<{ assetId?: string, url?: string, role?: string }>,
 *   brandLogo?: { assetId?: string, url?: string }|null,
 *   brandRefs?: Array<{ assetId?: string, url?: string, role?: string }>,
 *   campaignRefs?: Array<{ assetId?: string, url?: string, role?: string }>,
 *   includeBrandLogo?: boolean,
 *   maxImages?: number,
 * }} parts
 */
export function buildOrderedCampaignReferences(parts = {}) {
  const max = parts.maxImages ?? CAMPAIGN_MAX_REFERENCE_IMAGES;
  const slots = [];
  const seenUrl = new Set();
  const seenAsset = new Set();

  const push = (ref, role) => {
    if (slots.length >= max) return;
    const url = ref?.url;
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (seenUrl.has(url)) return;
    if (ref.assetId && seenAsset.has(ref.assetId)) return;
    seenUrl.add(url);
    if (ref.assetId) seenAsset.add(ref.assetId);
    slots.push({
      assetId: ref.assetId || null,
      url,
      role: role || ref.role || 'campaign_reference',
    });
  };

  for (const r of parts.productRefs || []) push(r, r.role || 'product_reference');
  for (const r of parts.characterRefs || []) push(r, r.role || 'character_reference');
  if (parts.includeBrandLogo && parts.brandLogo) {
    push(parts.brandLogo, 'brand_logo');
  }
  for (const r of parts.brandRefs || []) {
    if (parts.includeBrandLogo && parts.brandLogo?.url && r.url === parts.brandLogo.url) {
      continue;
    }
    push(r, r.role || 'brand_reference');
  }
  for (const r of parts.campaignRefs || []) push(r, r.role || 'creative_reference');

  return {
    references: slots,
    urls: slots.map((s) => s.url),
    orderedAssetIds: slots.map((s) => s.assetId).filter(Boolean),
    count: slots.length,
    maxImages: max,
  };
}

/**
 * @param {number} count
 * @param {number} [max]
 */
export function assertCampaignReferenceBudget(count, max = CAMPAIGN_MAX_REFERENCE_IMAGES) {
  if (count > max) {
    const err = new Error(
      `Campaign model accepts at most ${max} reference images (got ${count})`
    );
    err.code = 'TOO_MANY_REFERENCES';
    err.status = 400;
    throw err;
  }
}
