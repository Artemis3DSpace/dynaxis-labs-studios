import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  providerApiKeyFromRequest,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  requireCompositionRoutePermission,
  getComposition,
} from '@/lib/dynaxis/services/compositions.js';
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
  designAgentAuthScopeFromRoute,
} from '@/lib/dynaxis/services/design-agent.js';

async function authorizeCompositionAction(routeContext, ownerRef, compositionId, permission) {
  const loaded = await getComposition(ownerRef, compositionId);
  await requireCompositionRoutePermission(routeContext, loaded.composition, permission);
  return loaded.composition;
}

export async function POST(request) {
  const body = await request.json();
  const compositionId = body?.compositionId || undefined;
  const action = body?.action;
  const projectId = body?.projectId || undefined;

  let permission = 'design.read';
  if (action === 'readContext' || action === 'listAssets' || action === 'export') {
    permission = 'composition.read';
  } else if (
    action === 'apply' ||
    action === 'attachGeneratedAsset' ||
    action === 'saveRevision' ||
    action === 'adaptComposition'
  ) {
    permission = 'composition.update';
  } else if (action === 'prepareImage') {
    permission = 'composition.update';
  } else if (action === 'openFromAsset' || action === 'instantiateTemplate') {
    permission = 'composition.create';
  } else if (action === 'listTemplates') {
    permission = 'design_template.read';
  } else if (action === 'plan') {
    permission = 'design.read';
  }

  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        if (!action) {
          return jsonError(
            Object.assign(new Error('action required'), { code: 'ACTION_REQUIRED', status: 400 })
          );
        }

        const ownerRef = resolveRouteOwnerRef(routeContext);
        const authScope = designAgentAuthScopeFromRoute(routeContext);
        const providerApiKey = providerApiKeyFromRequest(request);

        if (compositionId) {
          await authorizeCompositionAction(routeContext, ownerRef, compositionId, permission);
        }

        switch (action) {
          case 'readContext':
            return jsonOk(
              await readDesignAgentContext(ownerRef, body.compositionId, { authScope })
            );
          case 'listAssets':
            return jsonOk(
              await listRelevantAssets(ownerRef, body.compositionId, {
                limit: body.limit,
                authScope,
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
                apiKey: providerApiKey,
                authScope,
              })
            );
          case 'apply':
            return jsonOk(
              await applyDesignAgentOperations(ownerRef, body, { authScope })
            );
          case 'prepareImage':
            return jsonOk(
              await prepareImageGeneration(ownerRef, body, { authScope })
            );
          case 'attachGeneratedAsset':
            return jsonOk(
              await attachGeneratedAsset(ownerRef, body, { authScope })
            );
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
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission,
      ...(compositionId ? { resourceId: compositionId, resourceType: 'composition' } : {}),
      ...(projectId ? { projectId } : {}),
      ...(action === 'listTemplates' ? { requireWorkspace: true } : {}),
    }
  );
}
