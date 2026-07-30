import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  createCharacter,
  listCharacters,
  resolveRouteServiceContext,
} from '@/lib/dynaxis/services/characters.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const characters = await listCharacters(ctx, { includeArchived });
        return jsonOk({ characters });
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'character.read', ...LEGACY_ROUTE }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
        const result = await createCharacter(ctx, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'character.create', ...LEGACY_ROUTE }
  );
}
