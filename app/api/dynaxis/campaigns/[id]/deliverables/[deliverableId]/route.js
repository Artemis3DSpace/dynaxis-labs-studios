import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCampaignDeliverable,
  generateCampaignDeliverableCopy,
  generateCampaignDeliverableImage,
  completeCampaignDeliverable,
  failCampaignDeliverable,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { deliverableId } = await params;
      return jsonOk(await getCampaignDeliverable(ownerRef, deliverableId));
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const { deliverableId } = await params;
      const body = await request.json();
      const action = body?.action;

      switch (action) {
        case 'generateCopy':
          return jsonOk(
            await generateCampaignDeliverableCopy(ownerRef, deliverableId, {
              apiKey,
            })
          );

        case 'prepareImage':
          return jsonOk(
            await generateCampaignDeliverableImage(ownerRef, deliverableId)
          );

        case 'complete':
          return jsonOk(
            await completeCampaignDeliverable(ownerRef, deliverableId, {
              generationId: body.generationId,
              assetId: body.assetId,
              appendHistory: body.appendHistory,
            })
          );

        case 'fail':
          return jsonOk(
            await failCampaignDeliverable(ownerRef, deliverableId, {
              errorCode: body.errorCode,
              errorMessage: body.errorMessage,
            })
          );

        case 'retry': {
          // Fail, then regenerate from the requested stage.
          // stage 'planned' / 'copy' → re-run copy; 'copy_ready' / 'image' → re-prepare image.
          await failCampaignDeliverable(ownerRef, deliverableId, {
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
              await generateCampaignDeliverableCopy(ownerRef, deliverableId, {
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
              await generateCampaignDeliverableImage(ownerRef, deliverableId)
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
  });
}
