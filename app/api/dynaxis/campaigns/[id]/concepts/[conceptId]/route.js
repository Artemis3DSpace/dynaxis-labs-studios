import { withPlatformAuth, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCampaignConcept,
  updateCampaignConcept,
  selectCampaignConcept,
} from '@/lib/dynaxis/services/campaigns.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { conceptId } = await params;
      return jsonOk(await getCampaignConcept(ownerRef, conceptId));
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function PATCH(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { conceptId } = await params;
      const body = await request.json();
      return jsonOk(await updateCampaignConcept(ownerRef, conceptId, body));
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function POST(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id, conceptId } = await params;
      const body = await request.json();
      if (body?.action !== 'select') {
        const err = new Error('Unsupported action; expected { action: "select" }');
        err.status = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      return jsonOk(await selectCampaignConcept(ownerRef, id, conceptId));
    } catch (err) {
      return jsonError(err);
    }
  });
}
