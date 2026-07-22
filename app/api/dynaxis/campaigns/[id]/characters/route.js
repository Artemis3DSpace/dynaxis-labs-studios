import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignCharacters,
  linkCampaignCharacter,
  unlinkCampaignCharacter,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listCampaignCharacters(ownerRef, id));
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
      return jsonOk(await linkCampaignCharacter(ownerRef, id, body), 201);
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
      const characterId = searchParams.get('characterId');
      if (!characterId) {
        const err = new Error('characterId query param required');
        err.status = 400;
        throw err;
      }
      return jsonOk(await unlinkCampaignCharacter(ownerRef, id, characterId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
