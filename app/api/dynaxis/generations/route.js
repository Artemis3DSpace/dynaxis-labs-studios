import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  listGenerationsForRoute,
  createGenerationForRoute,
  isLegacyRouteCompatibility,
} from '@/lib/dynaxis/services/generations.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId') || undefined;
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

        if (!isLegacyRouteCompatibility(routeContext)) {
          if (!projectId) {
            return jsonError(
              Object.assign(new Error('projectId is required'), {
                status: 400,
                code: 'VALIDATION_ERROR',
              })
            );
          }
          await requireRoutePermission(routeContext, {
            permission: 'generation.read',
            projectId,
          });
        }

        const generations = await listGenerationsForRoute(routeContext, { projectId, limit });
        return jsonOk({ generations });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const body = await request.json();
        const projectId = body?.projectId || undefined;

        if (!isLegacyRouteCompatibility(routeContext)) {
          if (!projectId) {
            return jsonError(
              Object.assign(new Error('projectId is required'), {
                status: 400,
                code: 'VALIDATION_ERROR',
              })
            );
          }
          await requireRoutePermission(routeContext, {
            permission: 'generation.create',
            projectId,
          });
        }

        const generation = await createGenerationForRoute(routeContext, body);
        return jsonOk({ generation }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
