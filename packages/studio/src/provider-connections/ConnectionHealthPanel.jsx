'use client';

import React from 'react';
import {
  deleteConnection,
  fetchConnectionHealth,
  revokeConnection,
  rotateConnectionSecret,
} from './api.js';
import {
  canDelete,
  canRevoke,
  canRotate,
  describeConnectionHealth,
  summarizeConnectionHealth,
} from './health-display.js';

/**
 * ProviderConnection health and rotation panel (WP-7D-06).
 *
 * Renders only the server's allowlist projection: id, provider, status,
 * health label, fingerprint, and timestamps. It never receives or renders
 * `secretRef`, `keyRef`, envelope metadata, IV, authTag, AAD, ciphertext, or
 * plaintext — `api.js` throws if a response ever carries one.
 *
 * The rotation input is held in local component state for the duration of the
 * submit and cleared immediately afterwards. It is never written to
 * localStorage, sessionStorage, a query cache, or a URL.
 */
export function ConnectionHealthPanel({ ownerType = 'workspace', className }) {
  const [connections, setConnections] = React.useState([]);
  const [status, setStatus] = React.useState('loading');
  const [error, setError] = React.useState(null);
  const [rotatingId, setRotatingId] = React.useState(null);
  const [secretDraft, setSecretDraft] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);

  const reload = React.useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setConnections(await fetchConnectionHealth({ ownerType }));
      setStatus('ready');
    } catch (err) {
      setError(err?.message || 'Unable to load provider connections');
      setStatus('error');
    }
  }, [ownerType]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const clearSecretDraft = React.useCallback(() => {
    setSecretDraft('');
    setRotatingId(null);
  }, []);

  async function handleRotate(connectionId) {
    if (!secretDraft.trim()) return;
    setBusyId(connectionId);
    setError(null);
    try {
      await rotateConnectionSecret(connectionId, secretDraft);
      // Drop the plaintext from component state before anything else.
      clearSecretDraft();
      await reload();
    } catch (err) {
      clearSecretDraft();
      setError(err?.message || 'Rotation failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(connectionId, action, confirmText) {
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return;
    setBusyId(connectionId);
    setError(null);
    try {
      await action(connectionId);
      await reload();
    } catch (err) {
      setError(err?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (status === 'loading') {
    return <div className={className}>Loading provider connections…</div>;
  }

  const summary = summarizeConnectionHealth(connections);

  return (
    <div className={className}>
      <div data-testid="connection-health-summary">
        {summary.total} connection(s) · {summary.healthy} healthy ·{' '}
        {summary.needsAttention} need attention · {summary.inactive} inactive
      </div>

      {error ? <div role="alert">{error}</div> : null}

      {connections.length === 0 ? (
        <p>No provider connections for this workspace.</p>
      ) : (
        <ul>
          {connections.map((connection) => {
            const display = describeConnectionHealth(connection.health);
            const busy = busyId === connection.id;
            return (
              <li key={connection.id} data-health={connection.health} data-tone={display.tone}>
                <div>
                  <strong>{connection.providerDisplayName || connection.providerId}</strong>{' '}
                  {connection.label ? <span>({connection.label})</span> : null}
                </div>
                <div>
                  Status: {connection.status} · Health: {display.label}
                  {connection.credentialFingerprint ? (
                    <span> · Fingerprint: {connection.credentialFingerprint}</span>
                  ) : null}
                </div>
                <div>
                  {connection.lastRotatedAt ? (
                    <span>Last rotated: {String(connection.lastRotatedAt)} </span>
                  ) : null}
                  {connection.rotationRequiredAt ? (
                    <span>Rotate by: {String(connection.rotationRequiredAt)}</span>
                  ) : null}
                </div>

                {rotatingId === connection.id ? (
                  <div>
                    <label>
                      New credential
                      <input
                        type="password"
                        autoComplete="off"
                        value={secretDraft}
                        onChange={(event) => setSecretDraft(event.target.value)}
                      />
                    </label>
                    <button type="button" disabled={busy} onClick={() => handleRotate(connection.id)}>
                      Submit rotation
                    </button>
                    <button type="button" disabled={busy} onClick={clearSecretDraft}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    {canRotate(connection) ? (
                      <button type="button" disabled={busy} onClick={() => setRotatingId(connection.id)}>
                        Rotate credential
                      </button>
                    ) : null}
                    {canRevoke(connection) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleAction(connection.id, revokeConnection, 'Revoke this connection?')
                        }
                      >
                        Revoke
                      </button>
                    ) : null}
                    {canDelete(connection) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleAction(connection.id, deleteConnection, 'Delete this connection?')
                        }
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ConnectionHealthPanel;
