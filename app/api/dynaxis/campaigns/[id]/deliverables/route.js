import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignDeliverables,
  createCampaignDeliverables,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const conceptId = searchParams.get('conceptId') || undefined;
      const status = searchParams.get('status') || undefined;
      const limit = Number(searchParams.get('limit') || 100);
      return jsonOk(
        await listCampaignDeliverables(ownerRef, id, {
          conceptId,
          status,
          limit,
        })
      );
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await createCampaignDeliverables(ownerRef, id, {
        conceptId: body.conceptId,
        formatIds: body.formatIds,
        includeBrandLogo: body.includeBrandLogo,
      });
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
