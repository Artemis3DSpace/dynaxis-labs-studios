import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createProject,
  listProjects,
  ensureDefaultProject,
} from '@/lib/dynaxis/services/projects.js';

export async function GET(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { searchParams } = new URL(request.url);
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const ensureDefault = searchParams.get('ensureDefault') !== 'false';
      if (ensureDefault) {
        await ensureDefaultProject(ownerRef);
      }
      const projects = await listProjects(ownerRef, { includeArchived });
      return jsonOk({ projects });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const body = await request.json();
      const project = await createProject(ownerRef, body);
      return jsonOk({ project }, 201);
    } catch (err) {
      return jsonError(err);
    }
  });
}
