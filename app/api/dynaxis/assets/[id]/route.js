import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getAsset } from '@/lib/dynaxis/services/assets.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const asset = await getAsset(ownerRef, id);
      if (!asset) {
        return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
      }
      return jsonOk({ asset });
    } catch (err) {
      return jsonError(err);
    }
  });
}
