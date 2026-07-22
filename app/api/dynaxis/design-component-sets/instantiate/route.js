import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { instantiateComponentSet } from '@/lib/dynaxis/services/component-sets.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const { compositionId, ...rest } = body || {};
      const result = await instantiateComponentSet(ownerRef, compositionId, rest);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
