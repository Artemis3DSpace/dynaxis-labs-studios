import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  readDesignAgentContext,
  listRelevantAssets,
  listRelevantTemplates,
  planDesignChanges,
  applyDesignAgentOperations,
  prepareImageGeneration,
  attachGeneratedAsset,
  designAgentInstantiateTemplate,
  designAgentAdaptComposition,
  designAgentSaveRevision,
  designAgentExport,
  designAgentOpenFromAsset,
} from '@/lib/dynaxis/services/design-agent.js';

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const body = await request.json();
      const action = body?.action;
      if (!action) {
        return jsonError(
          Object.assign(new Error('action required'), { code: 'ACTION_REQUIRED', status: 400 })
        );
      }

      switch (action) {
        case 'readContext':
          return jsonOk(await readDesignAgentContext(ownerRef, body.compositionId));
        case 'listAssets':
          return jsonOk(
            await listRelevantAssets(ownerRef, body.compositionId, {
              limit: body.limit,
            })
          );
        case 'listTemplates':
          return jsonOk(
            await listRelevantTemplates(ownerRef, {
              category: body.category,
              limit: body.limit,
            })
          );
        case 'plan':
          return jsonOk(
            await planDesignChanges(ownerRef, body, {
              apiKey,
            })
          );
        case 'apply':
          return jsonOk(await applyDesignAgentOperations(ownerRef, body));
        case 'prepareImage':
          return jsonOk(await prepareImageGeneration(ownerRef, body));
        case 'attachGeneratedAsset':
          return jsonOk(await attachGeneratedAsset(ownerRef, body));
        case 'instantiateTemplate':
          return jsonOk(await designAgentInstantiateTemplate(ownerRef, body));
        case 'adaptComposition':
          return jsonOk(await designAgentAdaptComposition(ownerRef, body));
        case 'saveRevision':
          return jsonOk(
            await designAgentSaveRevision(ownerRef, body.compositionId, body)
          );
        case 'export':
          return jsonOk(await designAgentExport(ownerRef, body.compositionId, body));
        case 'openFromAsset':
          return jsonOk(await designAgentOpenFromAsset(ownerRef, body));
        default:
          return jsonError(
            Object.assign(new Error(`Unknown action: ${action}`), {
              code: 'UNKNOWN_ACTION',
              status: 400,
            })
          );
      }
    } catch (err) {
      return jsonError(err);
    }
  });
}
