import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { switchComponentInstanceVariant } from '@/lib/dynaxis/services/component-sets.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const { compositionId, ...rest } = body || {};
      const result = await switchComponentInstanceVariant(ownerRef, compositionId, rest);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
