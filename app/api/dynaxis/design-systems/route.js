import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignSystems,
  createDesignSystem,
} from '@/lib/dynaxis/services/design-systems.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const result = await listDesignSystems(ownerRef, {
        status: searchParams.get('status') || undefined,
        brandId: searchParams.get('brandId') || undefined,
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
      const result = await createDesignSystem(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
