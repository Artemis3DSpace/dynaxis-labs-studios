import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getJob } from '@/lib/dynaxis/services/jobs.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const job = await getJob(ownerRef, id);
      if (!job) {
        return jsonError(Object.assign(new Error('Job not found'), { status: 404 }));
      }
      return jsonOk({ job });
    } catch (err) {
      return jsonError(err);
    }
  });
}
