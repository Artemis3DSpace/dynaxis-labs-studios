import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  addCharacterAsset,
  removeCharacterAsset,
  listCharacterAssets,
  promoteAssetToReference,
} from '@/lib/dynaxis/services/characters.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const assets = await listCharacterAssets(ownerRef, id);
      return jsonOk({ assets });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      if (body?.promote) {
        const result = await promoteAssetToReference(ownerRef, id, body.assetId, body);
        return jsonOk(result, 201);
      }
      const result = await addCharacterAsset(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
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
      const result = await removeCharacterAsset(ownerRef, id, assetId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
