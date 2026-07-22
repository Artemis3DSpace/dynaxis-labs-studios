import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { saveCompositionRevision } from '@/lib/dynaxis/services/compositions.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await saveCompositionRevision(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
