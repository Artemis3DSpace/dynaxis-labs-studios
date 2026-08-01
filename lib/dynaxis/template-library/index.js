/**
 * Dynaxis Template / Blueprint Library scaffold contracts.
 *
 * Pure contract layer only: no persistence, marketplace behavior, package
 * publishing, app generation, repository generation, or deployment behavior.
 */

export {
  TEMPLATE_CATEGORIES,
  SEMVER_PATTERN,
  requiredCapabilityReferenceSchema,
  provenanceSchema,
  templateMetadataSchema,
  templateValidationIssueSchema,
  templateValidationResultSchema,
  assertNoSecretLikeValues,
  validateTemplateMetadata,
} from './template-contracts.js';

export {
  DESIGN_SYSTEM_COMPATIBILITY_LEVELS,
  LAYOUT_COMPATIBILITY_MODES,
  designSystemCompatibilityReferenceSchema,
  layoutCompatibilityReferenceSchema,
  compatibilityMetadataSchema,
  validateCompatibilityMetadata,
} from './compatibility.js';

export {
  ALLOWED_TEMPLATE_LICENSES,
  ALLOWED_USAGE_MODES,
  licenseMetadataSchema,
  validateLicenseMetadata,
} from './license-contracts.js';

export {
  appPackContractSchema,
  blueprintPackageMetadataSchema,
  validateBlueprintPackageMetadata,
} from './package-metadata.js';

export {
  blueprintLibraryEntrySchema,
  blueprintLibrarySchema,
  validateBlueprintLibrary,
} from './blueprint-library.js';

export {
  searchableLibraryIndexEntrySchema,
  searchableLibraryIndexSchema,
  librarySearchFiltersSchema,
  validateSearchFilters,
} from './search-contracts.js';
