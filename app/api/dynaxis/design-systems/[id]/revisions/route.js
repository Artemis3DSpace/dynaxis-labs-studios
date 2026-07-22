import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createDesignSystemRevision,
  getDesignSystem,
} from '@/lib/dynaxis/services/design-systems.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await getDesignSystem(ownerRef, id);
      return jsonOk({ revisions: result.revisions });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await createDesignSystemRevision(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
