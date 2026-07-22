/**
 * S3-compatible Asset Blob Store — production durable object storage (server-only).
 * Supports AWS S3 and S3-compatible endpoints (MinIO, R2, etc.).
 */

import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { buildObjectKey, blobUrlForKey, assetStorageUnavailable } from './blob-store.js';
import { sha256Hex } from './png-validate.js';

/**
 * @param {object} [opts]
 * @returns {import('./blob-store.js').AssetBlobStore}
 */
export function createS3BlobStore(opts = {}) {
  const bucket = opts.bucket || process.env.DYNAXIS_S3_BUCKET;
  if (!bucket) {
    throw assetStorageUnavailable('DYNAXIS_S3_BUCKET is required for S3 asset storage');
  }

  const region = opts.region || process.env.DYNAXIS_S3_REGION || 'us-east-1';
  const endpoint = opts.endpoint || process.env.DYNAXIS_S3_ENDPOINT || undefined;
  const accessKeyId =
    opts.accessKeyId ||
    process.env.DYNAXIS_S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    opts.secretAccessKey ||
    process.env.DYNAXIS_S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;
  const publicBase =
    opts.publicBaseUrl || process.env.DYNAXIS_ASSET_PUBLIC_BASE_URL || '';
  const forcePathStyle =
    opts.forcePathStyle ??
    (process.env.DYNAXIS_S3_FORCE_PATH_STYLE === '1' || Boolean(endpoint));

  if (!accessKeyId || !secretAccessKey) {
    throw assetStorageUnavailable(
      'S3 credentials required (DYNAXIS_S3_ACCESS_KEY_ID / DYNAXIS_S3_SECRET_ACCESS_KEY)'
    );
  }

  const client =
    opts.client ||
    new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });

  function publicOrBlobUrl(key) {
    if (publicBase) {
      return `${publicBase.replace(/\/$/, '')}/${key}`;
    }
    // Private objects: controlled blob URL resolved via authenticated delivery / get()
    return blobUrlForKey('s3', key);
  }

  return {
    provider: /** @type {const} */ ('s3'),
    async put(bytes, putOpts = {}) {
      const key =
        putOpts.key ||
        buildObjectKey({
          prefix: opts.prefix || process.env.DYNAXIS_S3_PREFIX || 'dynaxis',
          ownerRef: putOpts.metadata?.ownerRef,
          projectId: putOpts.metadata?.projectId,
        });
      if (key.includes('..')) {
        const e = new Error('Invalid object key');
        e.code = 'BLOB_KEY_INVALID';
        e.status = 400;
        throw e;
      }
      const contentType = putOpts.contentType || 'application/octet-stream';
      const checksumSha256 = putOpts.checksumSha256 || sha256Hex(bytes);
      try {
        const out = await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
            Metadata: {
              checksumSha256,
              ...(putOpts.metadata || {}),
            },
          })
        );
        return {
          key,
          url: publicOrBlobUrl(key),
          contentType,
          byteSize: bytes.length,
          checksumSha256,
          provider: 's3',
          bucket,
          etag: out.ETag || null,
        };
      } catch (err) {
        const e = new Error(err.message || 'S3 put failed');
        e.code = 'ASSET_STORAGE_UNAVAILABLE';
        e.status = 503;
        e.cause = err;
        throw e;
      }
    },
    async get(key) {
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        const bytes = Buffer.from(await out.Body.transformToByteArray());
        return {
          bytes,
          contentType: out.ContentType || 'application/octet-stream',
        };
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw err;
      }
    },
    async getMetadata(key) {
      try {
        const out = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );
        return {
          key,
          contentType: out.ContentType || 'application/octet-stream',
          byteSize: out.ContentLength || 0,
          checksumSha256: out.Metadata?.checksumsha256 || null,
          provider: 's3',
        };
      } catch (err) {
        if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw err;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    },
  };
}
