/**
 * Design Agent context projections — controlled read surfaces (client-safe shapes).
 */

/**
 * @param {object|null} brand
 * @param {object|null} revision
 * @param {object|null} visual
 */
export function projectBrandContextForAgent(brand, revision = null, visual = null) {
  if (!brand) return null;
  return {
    brandId: brand.id,
    brandRevisionId: revision?.id || brand.currentRevisionId || null,
    name: brand.name,
    primaryColors: visual?.primaryColors || brand.primaryColors || [],
    secondaryColors: visual?.secondaryColors || brand.secondaryColors || [],
    fonts: visual?.fonts || brand.fonts || [],
    imageryStyle: visual?.imageryStyle || brand.imageryStyle || null,
    layoutStyle: visual?.layoutStyle || brand.layoutStyle || null,
    logoAssetId: visual?.logoAssetId || null,
    referenceAssetIds: (visual?.references || [])
      .map((r) => r.assetId)
      .filter(Boolean)
      .slice(0, 4),
  };
}

/**
 * @param {object|null} product
 * @param {Array} assets
 */
export function projectProductContextForAgent(product, assets = []) {
  if (!product) return null;
  const refs = (assets || [])
    .map((a) => ({
      assetId: a.assetId || a.asset?.id || a.id,
      role: a.role,
      isPrimary: Boolean(a.isPrimary),
    }))
    .filter((a) => a.assetId)
    .slice(0, 6);
  return {
    productId: product.id,
    name: product.name,
    description: product.description || null,
    referenceAssetIds: refs.map((r) => r.assetId),
    primaryAssetId: refs.find((r) => r.isPrimary)?.assetId || refs[0]?.assetId || null,
  };
}

/**
 * @param {object|null} character
 * @param {Array} assets
 */
export function projectCharacterContextForAgent(character, assets = []) {
  if (!character) return null;
  const refs = (assets || [])
    .map((a) => ({
      assetId: a.assetId || a.asset?.id || a.id,
      role: a.role || 'identity_reference',
      isPrimary: Boolean(a.isPrimary),
    }))
    .filter((a) => a.assetId)
    .slice(0, 6);
  return {
    characterId: character.id,
    name: character.name,
    // Intentionally omit chat history / system prompts
    referenceAssetIds: refs.map((r) => r.assetId),
    identityAssetId:
      refs.find((r) => r.role === 'identity_reference')?.assetId ||
      refs.find((r) => r.isPrimary)?.assetId ||
      refs[0]?.assetId ||
      null,
  };
}

/**
 * @param {object|null} campaign
 * @param {object|null} deliverable
 * @param {object|null} concept
 */
export function projectCampaignContextForAgent(campaign, deliverable = null, concept = null) {
  if (!campaign) return null;
  return {
    campaignId: campaign.id,
    name: campaign.name,
    goal: campaign.goal || null,
    conceptId: concept?.id || deliverable?.conceptId || campaign.selectedConceptId || null,
    conceptTitle: concept?.title || null,
    conceptTheme: concept?.theme || null,
    visualDirection: concept?.visualDirection || null,
    formatId: deliverable?.formatId || null,
    headline: deliverable?.headline || null,
    body: deliverable?.body || null,
    cta: deliverable?.cta || null,
    brandId: campaign.brandId || null,
    brandRevisionId: campaign.brandRevisionId || null,
  };
}

/**
 * Compact Composition summary for LLM prompts (design data is untrusted).
 * @param {object} composition
 * @param {object} document
 */
export function projectCompositionForAgent(composition, document) {
  return {
    compositionId: composition.id,
    name: composition.name,
    documentVersion: composition.documentVersion,
    projectId: composition.projectId,
    canvas: document.canvas,
    background: {
      kind: document.background?.kind,
      assetId: document.background?.assetId || null,
      color: document.background?.color || null,
    },
    layers: (document.layers || []).map((l) => ({
      id: l.id,
      type: l.type,
      role: l.role,
      name: l.name,
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      zIndex: l.zIndex,
      locked: l.locked,
      visible: l.visible,
      ...(l.type === 'text'
        ? {
            text: String(l.text || '').slice(0, 200),
            fontSize: l.fontSize,
            color: l.color,
            textAlign: l.textAlign,
          }
        : l.type === 'component_instance'
          ? {
              componentId: l.componentId,
              componentRevisionId: l.componentRevisionId,
              overrideCount: Array.isArray(l.overrides) ? l.overrides.length : 0,
            }
          : { assetId: l.assetId, fit: l.fit }),
    })),
    templateId: composition.templateId || null,
    templateRevisionId: composition.templateRevisionId || null,
    brandId: composition.brandId || null,
    campaignId: composition.campaignId || null,
    campaignDeliverableId: composition.campaignDeliverableId || null,
  };
}
