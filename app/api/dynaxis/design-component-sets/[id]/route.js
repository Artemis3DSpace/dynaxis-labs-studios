import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getDesignComponentSet,
  updateDesignComponentSet,
  archiveDesignComponentSet,
} from '@/lib/dynaxis/services/component-sets.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await getDesignComponentSet(ownerRef, id);
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
      const result = await updateDesignComponentSet(ownerRef, id, body);
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
      const result = await archiveDesignComponentSet(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
