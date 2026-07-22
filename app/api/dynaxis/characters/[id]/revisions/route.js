import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listCharacterRevisions } from '@/lib/dynaxis/services/characters.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const revisions = await listCharacterRevisions(ownerRef, id);
      return jsonOk({ revisions });
    } catch (err) {
      return jsonError(err);
    }
  });
}
