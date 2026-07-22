import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  setDeliverableFinalAsset,
  prepareCleanBackgroundRegeneration,
  applyCompositionBackgroundAsset,
} from '@/lib/dynaxis/services/compositions.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const action = body?.action;
      if (action === 'setFinalAsset') {
        const result = await setDeliverableFinalAsset(ownerRef, id, body);
        return jsonOk(result);
      }
      if (action === 'prepareCleanBackground') {
        const result = await prepareCleanBackgroundRegeneration(ownerRef, id);
        return jsonOk(result);
      }
      if (action === 'applyBackground') {
        const result = await applyCompositionBackgroundAsset(ownerRef, id, body);
        return jsonOk(result);
      }
      return jsonError(
        Object.assign(new Error(`Unknown action: ${action}`), {
          code: 'INVALID_ACTION',
          status: 400,
        })
      );
    } catch (err) {
      return jsonError(err);
    }
  });
}
