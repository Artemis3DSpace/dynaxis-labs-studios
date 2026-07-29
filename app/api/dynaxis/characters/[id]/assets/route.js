import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  addCharacterAsset,
  removeCharacterAsset,
  listCharacterAssets,
  promoteAssetToReference,
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
        const assets = await listCharacterAssets(ctx, id);
        return jsonOk({ assets });
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

export async function POST(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
        if (body?.promote) {
          const result = await promoteAssetToReference(ctx, id, body.assetId, body);
          return jsonOk(result, 201);
        }
        const result = await addCharacterAsset(ctx, id, body);
        return jsonOk(result, 201);
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
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');
  if (!assetId) {
    return jsonError(
      Object.assign(new Error('assetId query required'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      })
    );
  }
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await removeCharacterAsset(ctx, id, assetId);
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
