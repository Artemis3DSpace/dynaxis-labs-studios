import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listProductAssets,
  addProductAsset,
  removeProductAsset,
  promoteAssetToProductReference,
} from '@/lib/dynaxis/services/products.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await listProductAssets(ownerRef, id);
      return jsonOk(result);
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
      const result = body?.promote
        ? await promoteAssetToProductReference(ownerRef, id, body)
        : await addProductAsset(ownerRef, id, body);
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
        const err = new Error('assetId query param required');
        err.status = 400;
        err.code = 'ASSET_ID_REQUIRED';
        throw err;
      }
      const result = await removeProductAsset(ownerRef, id, assetId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
