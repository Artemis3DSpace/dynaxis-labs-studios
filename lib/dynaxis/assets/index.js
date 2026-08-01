/**
 * Dynaxis Asset Library / Media Registry scaffold contracts.
 *
 * Pure domain contract layer only: no uploads, storage providers, persistence,
 * migrations, media processing, app generation, or runtime service integration.
 */

export {
  MEDIA_TYPE_CATEGORIES,
  FILE_METADATA_SOURCE_TYPES,
  fileMetadataPlaceholderSchema,
  imageAssetMetadataSchema,
  videoAssetMetadataSchema,
  audioAssetMetadataSchema,
  documentAssetMetadataSchema,
  model3dAssetMetadataSchema,
  typedMediaMetadataSchema,
  mediaMetadataSchema,
  validateMediaMetadata,
} from './media-metadata.js';

export {
  ALLOWED_ASSET_LICENSES,
  ALLOWED_ASSET_USAGE_RIGHTS,
  ALLOWED_DERIVATIVE_RIGHTS,
  licenseMetadataSchema,
  validateLicenseMetadata,
} from './license-contracts.js';

export {
  ASSET_USAGE_CONTEXTS,
  ASSET_USAGE_SCOPES,
  ASSET_USAGE_INTENTS,
  provenanceMetadataSchema,
  usageMetadataSchema,
  assetValidationIssueSchema,
  assetValidationResultSchema,
} from './usage-contracts.js';

export {
  assetIdSchema,
  assetUsageContextSchema,
  assetUsageReferenceSchema,
  validateAssetUsageReference,
} from './asset-references.js';

export {
  ASSET_KINDS,
  assetContractSchema,
  assertNoSecretLikeValues,
  toPublicAssetProjection,
  validateAssetContract,
} from './asset-contracts.js';

export {
  ASSET_COLLECTION_KINDS,
  collectionItemReferenceSchema,
  assetCollectionMetadataSchema,
  validateAssetCollectionMetadata,
} from './collection-contracts.js';
