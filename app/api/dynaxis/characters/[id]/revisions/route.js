import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCharacterRevisions,
  resolveRouteServiceContext,
  characterOwnershipRepository,
} from '@/lib/dynaxis/services/characters.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const revisions = await listCharacterRevisions(ctx, id);
        return jsonOk({ revisions });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.read',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
