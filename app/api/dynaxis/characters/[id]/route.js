import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCharacter,
  updateCharacter,
  archiveCharacter,
} from '@/lib/dynaxis/services/characters.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const includeAssets = searchParams.get('includeAssets') === 'true';
      const character = await getCharacter(ownerRef, id, { includeAssets });
      if (!character) {
        return jsonError(Object.assign(new Error('Character not found'), { status: 404, code: 'CHARACTER_NOT_FOUND' }));
      }
      return jsonOk({ character });
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
      if (body?.status === 'archived' && Object.keys(body).length === 1) {
        const result = await archiveCharacter(ownerRef, id);
        return jsonOk(result);
      }
      const result = await updateCharacter(ownerRef, id, body);
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
      const result = await archiveCharacter(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
