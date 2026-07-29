import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getApiKeyFromRequest } from '@/lib/dynaxis/ownership.js';
import {
  getCampaignDeliverable,
  generateCampaignDeliverableCopy,
  generateCampaignDeliverableImage,
  completeCampaignDeliverable,
  failCampaignDeliverable,
  resolveRouteServiceContext,
  campaignOwnershipRepository,
} from '@/lib/dynaxis/services/campaigns.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id, deliverableId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        return jsonOk(await getCampaignDeliverable(ctx, deliverableId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.read', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function POST(request, { params }) {
  const { id, deliverableId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const apiKey = routeContext.legacyCompatibility?.used
          ? getApiKeyFromRequest(request)
          : undefined;
        const body = await request.json();
              const action = body?.action;

              switch (action) {
                case 'generateCopy':
                  return jsonOk(
                    await generateCampaignDeliverableCopy(ctx, deliverableId, {
                      apiKey,
                    })
                  );

                case 'prepareImage':
                  return jsonOk(
                    await generateCampaignDeliverableImage(ctx, deliverableId)
                  );

                case 'complete':
                  return jsonOk(
                    await completeCampaignDeliverable(ctx, deliverableId, {
                      generationId: body.generationId,
                      assetId: body.assetId,
                      appendHistory: body.appendHistory,
                    })
                  );

                case 'fail':
                  return jsonOk(
                    await failCampaignDeliverable(ctx, deliverableId, {
                      errorCode: body.errorCode,
                      errorMessage: body.errorMessage,
                    })
                  );

                case 'retry': {
                  // Fail, then regenerate from the requested stage.
                  // stage 'planned' / 'copy' → re-run copy; 'copy_ready' / 'image' → re-prepare image.
                  await failCampaignDeliverable(ctx, deliverableId, {
                    errorCode: body.errorCode || 'CAMPAIGN_DELIVERABLE_RETRY',
                    errorMessage: body.errorMessage || 'Retrying campaign deliverable',
                  });

                  const stage = body.stage;
                  if (
                    stage === 'planned' ||
                    stage === 'copy' ||
                    stage === 'generateCopy'
                  ) {
                    return jsonOk(
                      await generateCampaignDeliverableCopy(ctx, deliverableId, {
                        apiKey,
                      })
                    );
                  }
                  if (
                    stage === 'copy_ready' ||
                    stage === 'image' ||
                    stage === 'prepareImage'
                  ) {
                    return jsonOk(
                      await generateCampaignDeliverableImage(ctx, deliverableId)
                    );
                  }

                  const err = new Error(
                    'retry requires body.stage of planned|copy|generateCopy or copy_ready|image|prepareImage'
                  );
                  err.status = 400;
                  err.code = 'VALIDATION_ERROR';
                  throw err;
                }

                default: {
                  const err = new Error(
                    'Unsupported action; expected generateCopy|prepareImage|complete|fail|retry'
                  );
                  err.status = 400;
                  err.code = 'VALIDATION_ERROR';
                  throw err;
                }
              }
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}
