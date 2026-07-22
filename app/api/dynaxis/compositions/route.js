import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCompositions,
  createCompositionFromAsset,
} from '@/lib/dynaxis/services/compositions.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId') || undefined;
      const campaignId = searchParams.get('campaignId') || undefined;
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const limit = Number(searchParams.get('limit') || 100);
      const result = await listCompositions(ownerRef, {
        projectId,
        campaignId,
        includeArchived,
        limit,
      });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await createCompositionFromAsset(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
