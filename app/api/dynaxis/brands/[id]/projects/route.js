import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandProjects,
  linkBrandToProject,
  unlinkBrandFromProject,
} from '@/lib/dynaxis/services/brands.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      return jsonOk(await listBrandProjects(ownerRef, id));
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
      return jsonOk(await linkBrandToProject(ownerRef, id, body), 201);
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
        throw err;
      }
      return jsonOk(await unlinkBrandFromProject(ownerRef, id, projectId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
