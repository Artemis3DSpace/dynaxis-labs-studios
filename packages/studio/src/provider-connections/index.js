/**
 * Studio ProviderConnection health/rotation surface (WP-7D-06).
 */

export {
  FORBIDDEN_CLIENT_FIELDS,
  ProviderConnectionResponseError,
  assertNoForbiddenFields,
  deleteConnection,
  fetchConnectionAudit,
  fetchConnectionDetail,
  fetchConnectionHealth,
  revokeConnection,
  rotateConnectionSecret,
} from './api.js';
export {
  CONNECTION_HEALTH_DISPLAY,
  canDelete,
  canRevoke,
  canRotate,
  describeConnectionHealth,
  summarizeConnectionHealth,
} from './health-display.js';
export { ConnectionHealthPanel } from './ConnectionHealthPanel.jsx';
