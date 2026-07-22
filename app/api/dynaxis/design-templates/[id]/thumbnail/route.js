import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  setTemplateThumbnail,
  generateTemplatePreview,
} from '@/lib/dynaxis/services/templates.js';

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      if (body?.generate) {
        const result = await generateTemplatePreview(ownerRef, id, body);
        return jsonOk(result);
      }
      const result = await setTemplateThumbnail(ownerRef, id, body);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
