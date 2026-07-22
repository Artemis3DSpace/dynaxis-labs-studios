import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignComponentSets,
  createDesignComponentSet,
} from '@/lib/dynaxis/services/component-sets.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const result = await listDesignComponentSets(ownerRef, {
        status: searchParams.get('status') || undefined,
        category: searchParams.get('category') || undefined,
        q: searchParams.get('q') || undefined,
        includeArchived: searchParams.get('includeArchived') === 'true',
        limit: Number(searchParams.get('limit') || 100),
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
      const result = await createDesignComponentSet(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
