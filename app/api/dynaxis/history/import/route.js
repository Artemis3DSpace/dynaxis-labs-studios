import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { importLocalHistory } from '@/lib/dynaxis/services/history-compat.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const summary = await importLocalHistory(ownerRef, body);
      return jsonOk(summary);
    } catch (err) {
      return jsonError(err);
    }
  });
}
