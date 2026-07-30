import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCharacter,
  updateCharacter,
  archiveCharacter,
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
        const { searchParams } = new URL(request.url);
        const includeAssets = searchParams.get('includeAssets') === 'true';
        const character = await getCharacter(ctx, id, { includeAssets });
        if (!character) {
          return jsonError(
            Object.assign(new Error('Character not found'), {
              status: 404,
              code: 'CHARACTER_NOT_FOUND',
            })
          );
        }
        return jsonOk({ character });
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

export async function PATCH(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
        if (body?.status === 'archived' && Object.keys(body).length === 1) {
          const result = await archiveCharacter(ctx, id);
          return jsonOk(result);
        }
        const result = await updateCharacter(ctx, id, body);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.update',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await archiveCharacter(ctx, id);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.delete',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
