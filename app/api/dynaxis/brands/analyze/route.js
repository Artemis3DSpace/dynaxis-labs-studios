import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { analyzeBrandWebsite } from '@/lib/dynaxis/brands/analyzer.js';
import { getApiKeyFromRequest } from '@/lib/dynaxis/ownership.js';
import { z } from 'zod';

const bodySchema = z.object({ url: z.string().url().max(2000) });
const LEGACY_ROUTE = { legacyCompatibility: true };

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const body = bodySchema.parse(await request.json());
        const apiKey = routeContext.legacyCompatibility?.used
          ? getApiKeyFromRequest(request)
          : null;
        const result = await analyzeBrandWebsite(apiKey, body.url);
        return jsonOk({ draft: result.draft, sourceSnapshot: result.sourceSnapshot });
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.create', ...LEGACY_ROUTE }
  );
}
