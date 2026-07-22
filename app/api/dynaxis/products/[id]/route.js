import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getProduct,
  updateProduct,
  archiveProduct,
} from '@/lib/dynaxis/services/products.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const includeAssets = searchParams.get('includeAssets') !== 'false';
      const result = await getProduct(ownerRef, id, { includeAssets });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function PATCH(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await updateProduct(ownerRef, id, body);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await archiveProduct(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
