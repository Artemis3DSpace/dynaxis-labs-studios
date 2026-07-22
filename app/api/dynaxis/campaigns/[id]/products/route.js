import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignProducts,
  linkCampaignProduct,
  unlinkCampaignProduct,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listCampaignProducts(ownerRef, id));
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
      return jsonOk(await linkCampaignProduct(ownerRef, id, body), 201);
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
      return jsonOk(await unlinkCampaignProduct(ownerRef, id, productId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
