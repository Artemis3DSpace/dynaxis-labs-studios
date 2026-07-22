import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { resolveDesignComponentSetVariant } from '@/lib/dynaxis/services/component-sets.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await resolveDesignComponentSetVariant(
        ownerRef,
        id,
        body?.combination || {}
      );
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
