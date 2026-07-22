import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { exportComposition } from '@/lib/dynaxis/services/compositions.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await exportComposition(ownerRef, id);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
