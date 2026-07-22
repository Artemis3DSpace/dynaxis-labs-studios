import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCampaign,
  updateCampaign,
  archiveCampaign,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const includeRelations = searchParams.get('includeRelations') !== 'false';
      const result = await getCampaign(ownerRef, id, { includeRelations });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function PATCH(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await updateCampaign(ownerRef, id, body);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await archiveCampaign(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
