import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getDesignSystemRevision } from '@/lib/dynaxis/services/design-systems.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { revisionId } = await params;
      const result = await getDesignSystemRevision(ownerRef, revisionId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
