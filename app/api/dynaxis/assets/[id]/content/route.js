/**
 * Authenticated delivery of Dynaxis-managed blob Assets (private / non-CDN URLs).
 */

import { withPlatformAuth, jsonError } from '@/lib/dynaxis/api';
import { getAsset } from '@/lib/dynaxis/services/assets.js';
import { resolveAssetBlobStore, parseBlobUrl } from '@/lib/dynaxis/storage/blob-store.js';

export async function GET(request, { params }) {
  return withPlatformAuth(request, async ({ ownerRef }) => {
    try {
      const { id } = await params;
      const asset = await getAsset(ownerRef, id);
      if (!asset) {
        return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
      }

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
    } catch (err) {
      return jsonError(err);
    }
  });
}
