import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listProductBrands,
  linkBrandToProduct,
  unlinkBrandFromProduct,
} from '@/lib/dynaxis/services/brands.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listProductBrands(ownerRef, id));
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id: productId } = await params;
      const body = await request.json();
      const brandId = body?.brandId;
      if (!brandId) {
        const err = new Error('brandId is required');
        err.status = 400;
        throw err;
      }
      return jsonOk(
        await linkBrandToProduct(ownerRef, brandId, {
          productId,
          isPrimary: body?.isPrimary !== false,
          metadata: body?.metadata,
        }),
        201
      );
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id: productId } = await params;
      const { searchParams } = new URL(request.url);
      const brandId = searchParams.get('brandId');
      if (!brandId) {
        const err = new Error('brandId query param required');
        err.status = 400;
        throw err;
      }
      return jsonOk(await unlinkBrandFromProduct(ownerRef, brandId, productId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
