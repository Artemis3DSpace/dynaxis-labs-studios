import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listProductRevisions } from '@/lib/dynaxis/services/products.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await listProductRevisions(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
