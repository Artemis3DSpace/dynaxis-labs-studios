import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignTemplates,
  createDesignTemplate,
  createTemplateFromComposition,
} from '@/lib/dynaxis/services/templates.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const category = searchParams.get('category') || undefined;
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const limit = Number(searchParams.get('limit') || 100);
      const result = await listDesignTemplates(ownerRef, {
        status,
        category,
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
      if (body?.fromComposition || body?.compositionId) {
        const result = await createTemplateFromComposition(ownerRef, body);
        return jsonOk(result, 201);
      }
      const result = await createDesignTemplate(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
