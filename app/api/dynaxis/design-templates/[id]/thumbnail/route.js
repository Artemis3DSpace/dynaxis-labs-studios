import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  generateTemplatePreview,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/templates.js';

export async function POST(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const body = await request.json();
        const result = await generateTemplatePreview(ownerRef, id, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_template.update', requireWorkspace: true }
  );
}
