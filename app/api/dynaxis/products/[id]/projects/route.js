import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listProductProjects,
  linkProductToProject,
  unlinkProductFromProject,
} from '@/lib/dynaxis/services/products.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const result = await listProductProjects(ownerRef, id);
      return jsonOk(result);
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
      const result = await linkProductToProject(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId');
      if (!projectId) {
        const err = new Error('projectId query param required');
        err.status = 400;
        err.code = 'PROJECT_ID_REQUIRED';
        throw err;
      }
      const result = await unlinkProductFromProject(ownerRef, id, projectId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
