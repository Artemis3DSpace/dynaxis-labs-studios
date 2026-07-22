/**
 * Campaign Studio domain capability — headless-friendly.
 */

import { CAMPAIGN_GOALS } from '../../../lib/dynaxis/campaigns/goals.js';
import { CAMPAIGN_FORMATS, getCampaignFormat } from '../../../lib/dynaxis/campaigns/formats.js';

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export async function createCampaign(runtime, input) {
  if (!runtime?.createCampaign) throw err('RUNTIME_MISSING', 'Mini App runtime required');
  return runtime.createCampaign(input);
}

export async function generateCampaignConcepts(runtime, campaignId) {
  if (!runtime?.generateCampaignConcepts) {
    throw err('RUNTIME_MISSING', 'Mini App runtime required');
  }
  return runtime.generateCampaignConcepts(campaignId, {});
}

export async function updateCampaignConcept(runtime, campaignId, conceptId, input) {
  return runtime.updateCampaignConcept(campaignId, conceptId, input);
}

export async function selectCampaignConcept(runtime, campaignId, conceptId) {
  return runtime.selectCampaignConcept(campaignId, conceptId);
}

export async function createCampaignDeliverables(runtime, campaignId, input) {
  return runtime.createCampaignDeliverables(campaignId, input);
}

/**
 * Generate copy then image for one deliverable via runtime APIs + createGeneration.
 */
export async function generateCampaignDeliverable(runtime, campaignId, deliverableId) {
  if (!runtime?.campaignDeliverableAction) {
    throw err('RUNTIME_MISSING', 'Mini App runtime required');
  }
  const copyRes = await runtime.campaignDeliverableAction(campaignId, deliverableId, {
    action: 'generateCopy',
  });
  const imagePrep = await runtime.campaignDeliverableAction(campaignId, deliverableId, {
    action: 'prepareImage',
  });
  const generationRequest = imagePrep?.generationRequest;
  if (!generationRequest || !runtime.createGeneration) {
    return { copy: copyRes, image: imagePrep, executed: false };
  }
  const outcome = await runtime.createGeneration(generationRequest);
  const asset = outcome?.assets?.[0] || null;
  if (asset?.id) {
    await runtime.campaignDeliverableAction(campaignId, deliverableId, {
      action: 'complete',
      generationId: outcome?.generation?.id || null,
      assetId: asset.id,
    });
  } else if (outcome?.executed === false) {
    // dry-run — leave generating/copy_ready
  } else {
    await runtime.campaignDeliverableAction(campaignId, deliverableId, {
      action: 'fail',
      errorCode: 'CAMPAIGN_IMAGE_EMPTY',
      errorMessage: 'Generation completed without image asset',
    });
  }
  return { copy: copyRes, image: imagePrep, outcome, executed: Boolean(outcome?.executed) };
}

/**
 * Limited-concurrency batch. Partial success supported.
 */
export async function generateCampaignDeliverableBatch(
  runtime,
  campaignId,
  deliverableIds,
  { concurrency = 2 } = {}
) {
  const ids = Array.isArray(deliverableIds) ? deliverableIds.filter(Boolean) : [];
  const results = [];
  let i = 0;
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const r = await generateCampaignDeliverable(runtime, campaignId, id);
        results.push({ deliverableId: id, ok: true, result: r });
      } catch (e) {
        results.push({
          deliverableId: id,
          ok: false,
          error: e?.message || String(e),
          code: e?.code || null,
        });
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, ids.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    generationCount: ids.length,
  };
}

export async function attachCampaignAsset(runtime, campaignId, input) {
  return runtime.attachCampaignAsset(campaignId, input);
}

export async function invokeCapability(name, args, runtime) {
  switch (name) {
    case 'createCampaign':
      return createCampaign(runtime, args || {});
    case 'generateCampaignConcepts':
    case 'generateConcepts':
      return generateCampaignConcepts(runtime, args?.campaignId);
    case 'updateCampaignConcept':
      return updateCampaignConcept(
        runtime,
        args?.campaignId,
        args?.conceptId,
        args || {}
      );
    case 'selectCampaignConcept':
      return selectCampaignConcept(runtime, args?.campaignId, args?.conceptId);
    case 'createCampaignDeliverables':
      return createCampaignDeliverables(runtime, args?.campaignId, args || {});
    case 'generateCampaignDeliverable':
      return generateCampaignDeliverable(
        runtime,
        args?.campaignId,
        args?.deliverableId
      );
    case 'generateCampaignDeliverableBatch':
      return generateCampaignDeliverableBatch(
        runtime,
        args?.campaignId,
        args?.deliverableIds || [],
        args || {}
      );
    case 'attachCampaignAsset':
      return attachCampaignAsset(runtime, args?.campaignId, args || {});
    case 'listGoals':
      return { goals: CAMPAIGN_GOALS };
    case 'listFormats':
      return { formats: CAMPAIGN_FORMATS };
    case 'getFormat':
      return { format: getCampaignFormat(args?.formatId) };
    default:
      throw err('UNKNOWN_CAPABILITY', `Unknown Campaign Studio capability: ${name}`);
  }
}

export { CAMPAIGN_GOALS, CAMPAIGN_FORMATS };
