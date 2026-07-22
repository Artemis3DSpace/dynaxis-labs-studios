import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  adaptComposition,
  batchAdaptComposition,
} from '@/lib/dynaxis/services/templates.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      if (Array.isArray(body?.targets)) {
        const result = await batchAdaptComposition(ownerRef, body);
        return jsonOk(result, 201);
      }
      const result = await adaptComposition(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
