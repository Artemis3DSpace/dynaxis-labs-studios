import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignCharacters,
  linkCampaignCharacter,
  unlinkCampaignCharacter,
  resolveRouteServiceContext,
  campaignOwnershipRepository,
} from '@/lib/dynaxis/services/campaigns.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        return jsonOk(await listCampaignCharacters(ctx, id));
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'campaign.read',
      resourceId: id,
      resourceType: 'campaign',
      resourceRepository: campaignOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function POST(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
        return jsonOk(await linkCampaignCharacter(ctx, id, body), 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'campaign.update',
      resourceId: id,
      resourceType: 'campaign',
      resourceRepository: campaignOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const { searchParams } = new URL(request.url);
        const characterId = searchParams.get('characterId');
        if (!characterId) {
          const err = new Error('characterId query param required');
          err.status = 400;
          throw err;
        }
        return jsonOk(await unlinkCampaignCharacter(ctx, id, characterId));
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'campaign.update',
      resourceId: id,
      resourceType: 'campaign',
      resourceRepository: campaignOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
