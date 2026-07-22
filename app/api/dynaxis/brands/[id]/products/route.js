import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandProducts,
  linkBrandToProduct,
  unlinkBrandFromProduct,
} from '@/lib/dynaxis/services/brands.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listBrandProducts(ownerRef, id));
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
      return jsonOk(await linkBrandToProduct(ownerRef, id, body), 201);
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
      const productId = searchParams.get('productId');
      if (!productId) {
        const err = new Error('productId query param required');
        err.status = 400;
        throw err;
      }
      return jsonOk(await unlinkBrandFromProduct(ownerRef, id, productId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
