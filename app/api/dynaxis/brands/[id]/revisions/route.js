import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listBrandRevisions } from '@/lib/dynaxis/services/brands.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listBrandRevisions(ownerRef, id));
    } catch (err) {
      return jsonError(err);
    }
  });
}
