/**
 * Authenticated delivery of Dynaxis-managed blob Assets (private / non-CDN URLs).
 */

import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonError,
} from '@/lib/dynaxis/api';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '@/lib/dynaxis/auth/auth-context';
import {
  getAsset,
  getCanonicalAsset,
  assetOwnershipRepository,
} from '@/lib/dynaxis/services/assets.js';
import { resolveAssetBlobStore, parseBlobUrl } from '@/lib/dynaxis/storage/blob-store.js';

const ROUTE_AUTH_OPTS = Object.freeze({ legacyCompatibility: true });

function isLegacyAuthContext(authContext) {
  return authContext?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY;
}

function legacyOwnerRef(authContext) {
  return authContext?.compatibility?.ownerRef ?? authContext?.subject?.legacyOwnerRef ?? null;
}

async function deliverAssetBlob(asset) {
  const objectKey = asset.metadata?.storage?.objectKey;
  const provider = asset.metadata?.storage?.provider;
  let bytes;
  let contentType = asset.mimeType || 'application/octet-stream';

  if (objectKey && provider) {
    const store = await resolveAssetBlobStore({ driver: provider, forceNew: true });
    const got = await store.get(objectKey);
    if (!got) {
      return jsonError(
        Object.assign(new Error('Blob not found'), {
          code: 'ASSET_BLOB_NOT_FOUND',
          status: 404,
        })
      );
    }
    bytes = got.bytes;
    contentType = got.contentType || contentType;
  } else {
    const parsed = parseBlobUrl(asset.url);
    if (!parsed) {
      return jsonError(
        Object.assign(new Error('Asset is not a Dynaxis-managed blob'), {
          code: 'ASSET_NOT_MANAGED_BLOB',
          status: 400,
        })
      );
    }
    const store = await resolveAssetBlobStore({
      driver: parsed.provider,
      forceNew: true,
    });
    const got = await store.get(parsed.key);
    if (!got) {
      return jsonError(
        Object.assign(new Error('Blob not found'), {
          code: 'ASSET_BLOB_NOT_FOUND',
          status: 404,
        })
      );
    }
    bytes = got.bytes;
    contentType = got.contentType || contentType;
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=3600',
      'X-Dynaxis-Asset-Id': asset.id,
    },
  });
}

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { id } = await params;

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          const asset = await getAsset(ownerRef, id);
          if (!asset) {
            return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
          }
          return deliverAssetBlob(asset);
        }

        await requireRoutePermission(routeContext, {
          permission: 'asset.read',
          resourceId: id,
          resourceType: 'asset',
          resourceRepository: assetOwnershipRepository,
        });
        const asset = await getCanonicalAsset(id);
        if (!asset) {
          return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
        }
        return deliverAssetBlob(asset);
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}
