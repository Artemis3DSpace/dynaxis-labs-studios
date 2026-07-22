import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getGeneration } from '@/lib/dynaxis/services/generations.js';
import { listAssetsForGeneration } from '@/lib/dynaxis/services/assets.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const generation = await getGeneration(ownerRef, id);
      if (!generation) {
        return jsonError(Object.assign(new Error('Generation not found'), { status: 404 }));
      }
      const assets = await listAssetsForGeneration(id);
      return jsonOk({ generation, assets });
    } catch (err) {
      return jsonError(err);
    }
  });
}
