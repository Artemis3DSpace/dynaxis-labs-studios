import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCharacterConversation,
  sendCharacterMessage,
} from '@/lib/dynaxis/services/character-chat.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await getCharacterConversation(ownerRef, id);
      if (!result) {
        return jsonError(
          Object.assign(new Error('Conversation not found'), {
            status: 404,
            code: 'CONVERSATION_NOT_FOUND',
          })
        );
      }
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await sendCharacterMessage(ownerRef, id, body, { apiKey });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
