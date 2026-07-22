import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listComponentUsage } from '@/lib/dynaxis/services/components.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await listComponentUsage(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
