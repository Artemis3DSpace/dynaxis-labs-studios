/**
 * Dynaxis publish/export boundary contracts.
 *
 * Scaffold-only contract domain. This module intentionally excludes deployment,
 * publishing, export execution, job dispatch, filesystem writes, persistence,
 * migrations, and external provider integrations.
 */

export {
  EXPORT_FORMAT_CATEGORIES,
  EXPORT_REQUEST_MODES,
  exportProvenanceSchema,
  exportRequestSchema,
  validateExportRequest,
} from './export-contracts.js';

export {
  PUBLISH_TARGET_TYPES,
  PUBLISH_TARGET_MODES,
  DEPLOYMENT_BOUNDARY_MODES,
  publishTargetPlaceholderSchema,
  deploymentBoundaryPlaceholderSchema,
  validatePublishTargetPlaceholder,
  validateDeploymentBoundaryPlaceholder,
} from './publish-targets.js';

export {
  PACKAGE_ARTIFACT_TYPES,
  ARTIFACT_MANIFEST_MODES,
  artifactProvenanceSchema,
  packageArtifactMetadataSchema,
  artifactManifestEntrySchema,
  artifactManifestPlaceholderSchema,
  validatePackageArtifactMetadata,
  validateArtifactManifestPlaceholder,
} from './artifact-contracts.js';

export {
  PUBLISH_EXPORT_FORBIDDEN_PATH_PATTERNS,
  packageBoundaryRuleSchema,
  validatePackageBoundaryRules,
} from './package-boundaries.js';

export {
  PUBLISH_VALIDATION_GATE_STATUSES,
  validationGateIssueSchema,
  validationGateContractSchema,
  publishExportValidationResultSchema,
  assertNoRawSecretLikeValues,
  createPublicProjection,
  validateValidationGateContract,
  validatePublishExportValidationResult,
} from './validation-gates.js';
