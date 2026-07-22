import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { instantiateDesignTemplate } from '@/lib/dynaxis/services/templates.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await instantiateDesignTemplate(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
