import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCampaignConcept,
  updateCampaignConcept,
  selectCampaignConcept,
  resolveRouteServiceContext,
  campaignOwnershipRepository,
} from '@/lib/dynaxis/services/campaigns.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id, conceptId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        return jsonOk(await getCampaignConcept(ctx, conceptId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.read', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function PATCH(request, { params }) {
  const { id, conceptId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
              return jsonOk(await updateCampaignConcept(ctx, conceptId, body));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function POST(request, { params }) {
  const { id, conceptId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
              if (body?.action !== 'select') {
                const err = new Error('Unsupported action; expected { action: "select" }');
                err.status = 400;
                err.code = 'VALIDATION_ERROR';
                throw err;
              }
              return jsonOk(await selectCampaignConcept(ctx, id, conceptId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}
