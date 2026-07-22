import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { createCompositionFromDeliverable } from '@/lib/dynaxis/services/compositions.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await createCompositionFromDeliverable(ownerRef, body);
      return jsonOk(result, result.created ? 201 : 200);
    } catch (err) {
      return jsonError(err);
    }
  });
}
