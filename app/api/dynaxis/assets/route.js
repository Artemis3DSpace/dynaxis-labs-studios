import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { listAssets, registerAsset } from '@/lib/dynaxis/services/assets.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId') || undefined;
      const generationId = searchParams.get('generationId') || undefined;
      const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
      const assets = await listAssets(ownerRef, { projectId, generationId, limit });
      return jsonOk({ assets });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const asset = await registerAsset(ownerRef, body);
      return jsonOk({ asset }, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
