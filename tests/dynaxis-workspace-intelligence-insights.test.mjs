import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInsightCandidate,
  validateWorkspaceSummaryPlaceholder,
  validateRecommendationPlaceholder,
  classifySignalFromSeverity,
} from '../lib/dynaxis/workspace-intelligence/index.js';

test('insight contract requires provenance and evidence references', () => {
  assert.throws(
    () =>
      validateInsightCandidate({
        workspaceId: 'workspace_123',
        title: 'Project risk change',
        classification: 'risk',
        evidence: [{ eventId: 'event_1', source: 'jobs', reference: 'job:1' }],
      }),
    /provenance/i
  );

  assert.throws(
    () =>
      validateInsightCandidate({
        workspaceId: 'workspace_123',
        title: 'Project risk change',
        classification: 'risk',
        provenance: {
          derivedFrom: 'activity-analysis',
          generatedAt: new Date().toISOString(),
          method: 'rule_based',
        },
        evidence: [],
      }),
    /expected array to have >=1 items/i
  );
});

test('summary contract is placeholder only', () => {
  const summary = validateWorkspaceSummaryPlaceholder({
    kind: 'placeholder',
    workspaceId: 'workspace_123',
    windowStart: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    windowEnd: new Date().toISOString(),
  });

  assert.equal(summary.kind, 'placeholder');
  assert.equal(summary.workspaceId, 'workspace_123');

  assert.throws(
    () =>
      validateWorkspaceSummaryPlaceholder({
        kind: 'generated',
        workspaceId: 'workspace_123',
        windowStart: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        windowEnd: new Date().toISOString(),
      }),
    /placeholder/i
  );
});

test('recommendation contract remains placeholder-only', () => {
  const recommendation = validateRecommendationPlaceholder({
    kind: 'placeholder',
    workspaceId: 'workspace_123',
    title: 'Placeholder recommendation',
  });
  assert.equal(recommendation.kind, 'placeholder');
});

test('signal classification helper is deterministic for scaffold severities', () => {
  assert.equal(classifySignalFromSeverity('info'), 'operational');
  assert.equal(classifySignalFromSeverity('notice'), 'milestone');
  assert.equal(classifySignalFromSeverity('warning'), 'anomaly');
  assert.equal(classifySignalFromSeverity('critical'), 'risk');
});
