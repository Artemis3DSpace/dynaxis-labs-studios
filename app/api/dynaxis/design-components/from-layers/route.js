import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { createComponentFromLayers } from '@/lib/dynaxis/services/components.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await createComponentFromLayers(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
