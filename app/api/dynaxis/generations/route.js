import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listGenerations, createGeneration } from '@/lib/dynaxis/services/generations.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId') || undefined;
      const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
      const generations = await listGenerations(ownerRef, { projectId, limit });
      return jsonOk({ generations });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const generation = await createGeneration(ownerRef, body);
      return jsonOk({ generation }, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
