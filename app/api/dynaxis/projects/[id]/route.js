import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getProject, updateProject, archiveProject } from '@/lib/dynaxis/services/projects.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const project = await getProject(ownerRef, id);
      if (!project) {
        return jsonError(Object.assign(new Error('Project not found'), { status: 404, code: 'NOT_FOUND' }));
      }
      return jsonOk({ project });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function PATCH(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      if (body?.status === 'archived' && Object.keys(body).length === 1) {
        const project = await archiveProject(ownerRef, id);
        if (!project) {
          return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
        }
        return jsonOk({ project });
      }
      const project = await updateProject(ownerRef, id, body);
      if (!project) {
        return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
      }
      return jsonOk({ project });
    } catch (err) {
      return jsonError(err);
    }
  });
}
