import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignComponentSetVariants,
  upsertDesignComponentSetVariant,
} from '@/lib/dynaxis/services/component-sets.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await listDesignComponentSetVariants(ownerRef, id);
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
      const result = await upsertDesignComponentSetVariant(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
