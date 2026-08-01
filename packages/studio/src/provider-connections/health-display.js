/**
 * Presentation mapping for ProviderConnection health (WP-7D-06).
 *
 * Pure display metadata over the server's `health` label. No secret material,
 * no envelope state, and no key-management status is represented here — the
 * client only ever knows the label the server chose.
 */

export const CONNECTION_HEALTH_DISPLAY = Object.freeze({
  healthy: { label: 'Healthy', tone: 'positive', actionable: false },
  rotation_due_soon: { label: 'Rotation due soon', tone: 'warning', actionable: true },
  rotation_required: { label: 'Rotation required', tone: 'critical', actionable: true },
  pending: { label: 'Pending verification', tone: 'neutral', actionable: false },
  disabled: { label: 'Disabled', tone: 'neutral', actionable: false },
  revoked: { label: 'Revoked', tone: 'critical', actionable: false },
  deleted: { label: 'Deleted', tone: 'neutral', actionable: false },
  secret_missing: { label: 'Credential missing', tone: 'critical', actionable: true },
  secret_corrupted: { label: 'Credential corrupted', tone: 'critical', actionable: true },
  secret_unavailable: { label: 'Credential unavailable', tone: 'critical', actionable: true },
  expired: { label: 'Expired', tone: 'critical', actionable: true },
  provider_error: { label: 'Provider error', tone: 'warning', actionable: false },
  unknown: { label: 'Unknown', tone: 'neutral', actionable: false },
});

const FALLBACK = Object.freeze({ label: 'Unknown', tone: 'neutral', actionable: false });

export function describeConnectionHealth(health) {
  return CONNECTION_HEALTH_DISPLAY[health] || FALLBACK;
}

/** Rotation is offered only for states an operator can actually fix. */
export function canRotate(connection) {
  if (!connection) return false;
  if (connection.health === 'deleted' || connection.health === 'revoked') return false;
  return true;
}

export function canRevoke(connection) {
  if (!connection) return false;
  return connection.health !== 'deleted' && connection.health !== 'revoked';
}

export function canDelete(connection) {
  if (!connection) return false;
  return connection.health !== 'deleted';
}

/** Groups connections for a status summary without exposing anything extra. */
export function summarizeConnectionHealth(connections = []) {
  const summary = { total: 0, healthy: 0, needsAttention: 0, inactive: 0 };
  for (const connection of connections) {
    summary.total += 1;
    if (connection.health === 'healthy') {
      summary.healthy += 1;
    } else if (describeConnectionHealth(connection.health).actionable) {
      summary.needsAttention += 1;
    } else {
      summary.inactive += 1;
    }
  }
  return summary;
}
