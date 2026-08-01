import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGraphNodeKind,
  isGraphEdgeKind,
  validateGraphEdge,
  validateMemoryRecordContract,
  normalizeGraphRelationshipName,
} from '../lib/dynaxis/project-graph/index.js';

test('invalid node and edge kinds are rejected', () => {
  assert.equal(isGraphNodeKind('project'), true);
  assert.equal(isGraphNodeKind('unknown_node_kind'), false);
  assert.equal(isGraphEdgeKind('project_contains_asset'), true);
  assert.equal(isGraphEdgeKind('project-links-to-asset'), false);
});

test('graph edges require source, target, and kind', () => {
  assert.throws(() => validateGraphEdge({ target: 'b', kind: 'project_contains_asset' }), /requires source/);
  assert.throws(() => validateGraphEdge({ source: 'a', kind: 'project_contains_asset' }), /requires target/);
  assert.throws(() => validateGraphEdge({ source: 'a', target: 'b' }), /requires kind/);

  const parsed = validateGraphEdge({
    source: 'project:1',
    target: 'asset:2',
    kind: 'project_contains_asset',
  });
  assert.equal(parsed.source, 'project:1');
  assert.equal(parsed.target, 'asset:2');
  assert.equal(parsed.kind, 'project_contains_asset');
});

test('memory records require provenance', () => {
  assert.throws(
    () =>
      validateMemoryRecordContract({
        kind: 'fact',
        summary: 'A known fact',
      }),
    /Provenance is required/
  );

  const parsed = validateMemoryRecordContract({
    kind: 'fact',
    summary: 'A known fact',
    provenance: {
      actorType: 'agent',
      actorId: 'agent:reviewer',
      source: 'workflow_event',
      observedAt: new Date().toISOString(),
    },
  });
  assert.equal(parsed.kind, 'fact');
  assert.equal(parsed.provenance.actorType, 'agent');
});

test('graph relationship names are normalized consistently', () => {
  assert.equal(normalizeGraphRelationshipName('Project_Contains_Asset'), 'project_contains_asset');
  assert.equal(normalizeGraphRelationshipName('bad relation name'), null);
});
