import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { generateComponentThumbnail } from '@/lib/dynaxis/services/components.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const result = await generateComponentThumbnail(ownerRef, id, body || {});
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
