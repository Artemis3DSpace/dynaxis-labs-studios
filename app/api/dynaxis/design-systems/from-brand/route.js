import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { createDesignSystemFromBrand } from '@/lib/dynaxis/services/design-systems.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await createDesignSystemFromBrand(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
