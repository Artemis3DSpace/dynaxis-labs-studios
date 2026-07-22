/**
 * Client-safe Campaign Consumer / context helpers.
 */

/**
 * @param {object} campaign
 * @param {object|null} revision
 * @param {object} [extras]
 */
export function buildCampaignContext(campaign, revision = null, extras = {}) {
  return {
    campaign,
    revision: revision || {
      id: campaign?.currentRevisionId,
      impliedCurrent: true,
    },
    brandId: campaign?.brandId || null,
    brandRevisionId: campaign?.brandRevisionId || null,
    selectedConceptId: campaign?.selectedConceptId || extras.selectedConceptId || null,
    products: extras.products || [],
    characters: extras.characters || [],
    provenance: {
      campaignId: campaign?.id || null,
      campaignRevisionId: revision?.id || campaign?.currentRevisionId || null,
      brandId: campaign?.brandId || null,
      brandRevisionId: campaign?.brandRevisionId || null,
      projectId: campaign?.projectId || null,
      continuity: 'campaign-revision',
    },
  };
}

export function publishCampaignGenerationContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  window.__dynaxisCampaignId = ctx.campaignId || null;
  window.__dynaxisCampaignRevisionId = ctx.campaignRevisionId || null;
  window.__dynaxisCampaignConceptId = ctx.conceptId || null;
  window.__dynaxisCampaignDeliverableId = ctx.deliverableId || null;
  if (ctx.generationMetadata && typeof ctx.generationMetadata === 'object') {
    window.__dynaxisGenerationMetadata = {
      ...(window.__dynaxisGenerationMetadata &&
      typeof window.__dynaxisGenerationMetadata === 'object'
        ? window.__dynaxisGenerationMetadata
        : {}),
      ...ctx.generationMetadata,
      campaignId: ctx.campaignId || null,
      campaignRevisionId: ctx.campaignRevisionId || null,
    };
  }
}

export function clearCampaignGenerationContext() {
  if (typeof window === 'undefined') return;
  window.__dynaxisCampaignId = null;
  window.__dynaxisCampaignRevisionId = null;
  window.__dynaxisCampaignConceptId = null;
  window.__dynaxisCampaignDeliverableId = null;
}

export function readCampaignGenerationContext() {
  if (typeof window === 'undefined') {
    return {
      campaignId: null,
      campaignRevisionId: null,
      conceptId: null,
      deliverableId: null,
    };
  }
  return {
    campaignId: window.__dynaxisCampaignId || null,
    campaignRevisionId: window.__dynaxisCampaignRevisionId || null,
    conceptId: window.__dynaxisCampaignConceptId || null,
    deliverableId: window.__dynaxisCampaignDeliverableId || null,
  };
}

/**
 * @param {{ getCampaign: Function }} client
 * @param {string} campaignId
 */
export async function resolveCampaignContext(client, campaignId, options = {}) {
  if (!client?.getCampaign) {
    const err = new Error('Platform client required');
    err.code = 'CAMPAIGN_CLIENT_REQUIRED';
    throw err;
  }
  if (!campaignId) {
    const err = new Error('campaignId is required');
    err.code = 'CAMPAIGN_ID_REQUIRED';
    throw err;
  }
  const data = await client.getCampaign(campaignId, {
    includeRelations: 'true',
    ...(options.query || {}),
  });
  const campaign = data?.campaign || data;
  return buildCampaignContext(campaign, data?.revision || null, {
    products: data?.products || [],
    characters: data?.characters || [],
    selectedConceptId: campaign?.selectedConceptId,
  });
}
