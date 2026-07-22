import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listCampaignRevisions } from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listCampaignRevisions(ownerRef, id));
    } catch (err) {
      return jsonError(err);
    }
  });
}
