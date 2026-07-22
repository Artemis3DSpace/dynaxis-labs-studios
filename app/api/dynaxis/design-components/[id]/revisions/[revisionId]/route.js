import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getDesignComponentRevision } from '@/lib/dynaxis/services/components.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id, revisionId } = await params;
      const result = await getDesignComponentRevision(ownerRef, id, revisionId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
