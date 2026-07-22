import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { updateComponentInstanceRevision } from '@/lib/dynaxis/services/components.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const { compositionId, ...rest } = body || {};
      const result = await updateComponentInstanceRevision(ownerRef, compositionId, rest);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
