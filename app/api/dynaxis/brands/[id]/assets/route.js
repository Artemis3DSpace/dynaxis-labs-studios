import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandAssets,
  addBrandAsset,
  removeBrandAsset,
  promoteAssetToBrandReference,
} from '@/lib/dynaxis/services/brands.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listBrandAssets(ownerRef, id));
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
        ? await promoteAssetToBrandReference(ownerRef, id, body)
        : await addBrandAsset(ownerRef, id, body);
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
        throw err;
      }
      return jsonOk(await removeBrandAsset(ownerRef, id, assetId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
