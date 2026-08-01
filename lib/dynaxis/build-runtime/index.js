/**
 * Dynaxis Build Runtime scaffold contracts.
 *
 * This module is intentionally contract-only. It does not perform worker
 * dispatch, repository bootstrapping, GitHub operations, deployment, or
 * external API calls.
 */

export {
  BRIEF_UNSAFE_PATTERNS,
  validateBriefIntakeContract,
} from './brief-intake.js';
export { validateRequirementsExtractionResult } from './requirements.js';
export {
  validateArchitecturePlanningResult,
  validateBlueprintSelectionResult,
} from './blueprint-planning.js';
export {
  BUILD_RUNTIME_FORBIDDEN_PATH_PATTERNS,
  validateGeneratedWorkPackageContract,
} from './work-package-generation.js';
export {
  BRANCH_MANAGEMENT_MODES,
  REPOSITORY_BOOTSTRAP_MODES,
  validateGitHubBranchManagementPlaceholder,
  validateRepositoryBootstrapRequestPlaceholder,
} from './repository-bootstrap-contracts.js';
export {
  BUILD_VERIFICATION_GATE_STATUSES,
  validateBuildVerificationGateContract,
} from './verification-gates.js';
export {
  DEPLOYMENT_BOUNDARY_MODES,
  PREVIEW_BOUNDARY_MODES,
  validateDeploymentBoundaryPlaceholder,
  validatePreviewEnvironmentPlaceholder,
  validateRepairLoopContract,
} from './repair-loop-contracts.js';
