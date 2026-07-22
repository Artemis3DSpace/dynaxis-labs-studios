import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignConcepts,
  generateCampaignConcepts,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listCampaignConcepts(ownerRef, id));
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const { id } = await params;
      // Body empty is ok; apiKey comes from auth context.
      try {
        await request.json();
      } catch {
        // ignore empty / non-JSON body
      }
      const result = await generateCampaignConcepts(ownerRef, id, { apiKey });
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
