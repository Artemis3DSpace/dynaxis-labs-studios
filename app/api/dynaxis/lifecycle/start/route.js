import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { startLifecycle } from '@/lib/dynaxis/services/lifecycle.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await startLifecycle(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
