import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createCharacter,
  listCharacters,
} from '@/lib/dynaxis/services/characters.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const characters = await listCharacters(ownerRef, { includeArchived });
      return jsonOk({ characters });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const result = await createCharacter(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
