import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getTemplateRevision } from '@/lib/dynaxis/services/templates.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id, revisionId } = await params;
      const result = await getTemplateRevision(ownerRef, id, revisionId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
