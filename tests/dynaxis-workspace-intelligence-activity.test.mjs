import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkspaceActivityEvent,
  validateProjectActivityEvent,
  validateActivityVisibility,
} from '../lib/dynaxis/workspace-intelligence/index.js';

function validActor() {
  return {
    type: 'user',
    id: 'user_123',
    role: 'owner',
  };
}

function validSource() {
  return {
    system: 'project_graph',
    entityType: 'project',
    entityId: 'project_123',
  };
}

test('valid activity event passes', () => {
  const event = validateWorkspaceActivityEvent({
    workspaceId: 'workspace_123',
    actor: validActor(),
    source: validSource(),
    kind: 'workspace.updated',
    timestamp: new Date().toISOString(),
  });

  assert.equal(event.workspaceId, 'workspace_123');
  assert.equal(event.kind, 'workspace.updated');
});

test('activity event requires actor, source, kind, and timestamp', () => {
  assert.throws(
    () =>
      validateWorkspaceActivityEvent({
        workspaceId: 'workspace_123',
        source: validSource(),
        kind: 'workspace.updated',
        timestamp: new Date().toISOString(),
      }),
    /actor/i
  );

  assert.throws(
    () =>
      validateWorkspaceActivityEvent({
        workspaceId: 'workspace_123',
        actor: validActor(),
        kind: 'workspace.updated',
        timestamp: new Date().toISOString(),
      }),
    /source/i
  );

  assert.throws(
    () =>
      validateWorkspaceActivityEvent({
        workspaceId: 'workspace_123',
        actor: validActor(),
        source: validSource(),
        timestamp: new Date().toISOString(),
      }),
    /kind/i
  );

  assert.throws(
    () =>
      validateWorkspaceActivityEvent({
        workspaceId: 'workspace_123',
        actor: validActor(),
        source: validSource(),
        kind: 'workspace.updated',
      }),
    /timestamp/i
  );
});

test('unknown activity kind rejected', () => {
  assert.throws(
    () =>
      validateProjectActivityEvent({
        workspaceId: 'workspace_123',
        projectId: 'project_123',
        actor: validActor(),
        source: validSource(),
        kind: 'project.unknown_kind',
        timestamp: new Date().toISOString(),
      }),
    /invalid/i
  );
});

test('visibility contract validates public/internal/private values', () => {
  assert.equal(validateActivityVisibility('public'), 'public');
  assert.equal(validateActivityVisibility('internal'), 'internal');
  assert.equal(validateActivityVisibility('private'), 'private');
  assert.throws(() => validateActivityVisibility('team'), /invalid/i);
});
