import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { analyzeBrandWebsite } from '@/lib/dynaxis/brands/analyzer.js';
import { z } from 'zod';

const bodySchema = z.object({
  url: z.string().url().max(2000),
});

/**
 * Secure Brand website analysis endpoint.
 * Scraping stays server-side; Mini Apps call this via HTTP — no external:network grant.
 */
export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef, apiKey }) => {
    try {
      const body = bodySchema.parse(await request.json());
      void ownerRef;
      const result = await analyzeBrandWebsite(apiKey, body.url);
      return jsonOk({
        draft: result.draft,
        sourceSnapshot: result.sourceSnapshot,
      });
    } catch (err) {
      return jsonError(err);
    }
  });
}
