import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  findTrustedJobOwnership,
  getJobForRoute,
} from '@/lib/dynaxis/services/jobs.js';
import { isLegacyRouteCompatibility } from '@/lib/dynaxis/services/generations.js';

function notFound() {
  return Object.assign(new Error('Job not found'), {
    status: 404,
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.NOT_FOUND,
  });
}

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { id } = await params;

        if (!isLegacyRouteCompatibility(routeContext)) {
          const ownership = await findTrustedJobOwnership(id);
          if (!ownership) {
            return jsonError(notFound());
          }
          await requireRoutePermission(routeContext, {
            permission: 'job.read',
            projectId: ownership.projectId,
            resource: ownership,
            resourceType: 'job',
            resourceId: id,
          });
        }

        const job = await getJobForRoute(routeContext, id);
        if (!job) {
          return jsonError(notFound());
        }
        return jsonOk({ job });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
