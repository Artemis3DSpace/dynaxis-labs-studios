import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  startCharacterConversation,
  listCharacterConversations,
} from '@/lib/dynaxis/services/character-chat.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const characterId = searchParams.get('characterId') || undefined;
      const conversations = await listCharacterConversations(ownerRef, { characterId });
      return jsonOk({ conversations });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const body = await request.json();
      const result = await startCharacterConversation(ownerRef, body, { apiKey });
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
