import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignAssets,
  attachCampaignAsset,
  removeCampaignAsset,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listCampaignAssets(ownerRef, id));
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
      return jsonOk(await attachCampaignAsset(ownerRef, id, body), 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const assetId = searchParams.get('assetId');
      if (!assetId) {
        const err = new Error('assetId query param required');
        err.status = 400;
        throw err;
      }
      return jsonOk(await removeCampaignAsset(ownerRef, id, assetId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
