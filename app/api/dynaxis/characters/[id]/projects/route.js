import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  linkCharacterToProject,
  unlinkCharacterFromProject,
  listCharacterProjects,
} from '@/lib/dynaxis/services/characters.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const projects = await listCharacterProjects(ownerRef, id);
      return jsonOk({ projects });
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
      const result = await linkCharacterToProject(ownerRef, id, body.projectId);
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
        return jsonError(
          Object.assign(new Error('projectId query required'), {
            status: 400,
            code: 'VALIDATION_ERROR',
          })
        );
      }
      const result = await unlinkCharacterFromProject(ownerRef, id, projectId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
  });
}
