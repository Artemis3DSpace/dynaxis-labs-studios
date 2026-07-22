import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { completeLifecycle } from '@/lib/dynaxis/services/lifecycle.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await completeLifecycle(ownerRef, body);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
